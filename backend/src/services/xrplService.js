const { XummSdk } = require('xumm-sdk');
const xrpl = require('xrpl'); // <-- 1. CHANGE: Import the new library
const config = require('../config/config');

class XRPLService {
  constructor() {
    // 2. CHANGE: Instantiate the modern xrpl.Client
    this.api = new xrpl.Client(config.rippleNode);
    this.xumm = new XummSdk(config.xummApiKey, config.xummApiSecret);
  }

  async connect() {
    if (!this.api.isConnected()) {
      await this.api.connect();
      console.log(`✅ Connected to XRPL at ${config.rippleNode}`);
    }
  }

  async disconnect() {
    if (this.api.isConnected()) {
      await this.api.disconnect();
      console.log('🔌 Disconnected from XRPL');
    }
  }

  async createCollateralEscrowPayload(borrowerAddress, collateralAmount, termDays) {
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + termDays);
    const rippleEpochOffset = 946684800;
    const releaseAfter = Math.floor(releaseDate.getTime() / 1000) - rippleEpochOffset;

    const payload = await this.xumm.payload.create({
      txjson: {
        TransactionType: 'EscrowCreate',
        Account: borrowerAddress,
        Amount: xrpl.xrpToDrops(collateralAmount), // <-- Use xrpl.js utility
        Destination: config.platformEscrowAddress,
        FinishAfter: releaseAfter,
      }
    });
    return payload;
  }

  /**
   * Create a repayment payload for loan repayment
   * @param {string} borrowerAddress - Borrower's XRP address
   * @param {number} repaymentAmount - Amount to repay
   * @param {string} loanId - Loan ID for reference
   * @returns {Promise<object>} XUMM payload
   */
  async createRepaymentPayload(borrowerAddress, repaymentAmount, loanId) {
    // Create a Payment transaction to repay the loan
    const payload = await this.xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Account: borrowerAddress,
        Amount: xrpl.xrpToDrops(repaymentAmount),
        Destination: config.platformEscrowAddress,
        // Add memos to identify the transaction purpose and loan
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('repayment', 'utf8').toString('hex').toUpperCase(),
              MemoFormat: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(loanId, 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      // Optional: Add user instruction
      custom_meta: {
        instruction: `This transaction will repay ${repaymentAmount} XRP toward your loan.`
      }
    });
    
    return payload;
  }

  async verifySignature(payloadId) {
    // This function doesn't need to change, it uses the Xumm SDK
    const payload = await this.xumm.payload.get(payloadId);
    if (payload.meta.signed === true) {
      return {
        signed: true,
        txid: payload.response.txid,
        user: payload.response.account
      };
    }
    return { signed: false };
  }

  /**
   * Verify a repayment transaction on the XRPL
   * @param {string} txHash - Transaction hash of the repayment
   * @returns {Promise<object>} Verification result with transaction details
   */
  async verifyRepaymentTransaction(txHash) {
    await this.connect();
    try {
      // Get the transaction from the ledger
      const tx = await this.api.request({
        command: 'tx',
        transaction: txHash
      });
      
      // Check if the transaction was successful
      if (tx.result.meta.TransactionResult !== 'tesSUCCESS') {
        return { 
          verified: false, 
          message: `Transaction failed: ${tx.result.meta.TransactionResult}`
        };
      }
      
      // Extract payment details
      const paymentAmount = xrpl.dropsToXrp(tx.result.Amount);
      const sender = tx.result.Account;
      const receiver = tx.result.Destination;
      
      // Verify it's a payment to the platform address
      if (receiver !== config.platformEscrowAddress) {
        return { 
          verified: false, 
          message: 'Payment destination does not match platform address'
        };
      }
      
      return {
        verified: true,
        txHash,
        amount: paymentAmount,
        sender,
        receiver,
        date: new Date(tx.result.date)
      };
    } catch (error) {
      console.error('Error verifying repayment transaction:', error);
      return { 
        verified: false, 
        message: error.message
      };
    } finally {
      await this.disconnect();
    }
  }

  async disburseLoan(borrowerAddress, loanAmount) {
    await this.connect();
    try {
      const wallet = xrpl.Wallet.fromSeed(config.platformEscrowSecret);

      const paymentTx = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Amount: xrpl.xrpToDrops(loanAmount),
        Destination: borrowerAddress,
      };

      const prepared = await this.api.autofill(paymentTx);

      const signed = wallet.sign(prepared);
      const txHash = signed.hash;

      console.log(`[INFO] Submitting disbursement transaction with hash: ${txHash}`);

      const result = await this.api.submit(signed.tx_blob);

      if (result.result.engine_result === 'tesSUCCESS') {
        console.log('[SUCCESS] Disbursement successful.');
        return { success: true, txHash: txHash };
      } else {
        throw new Error(`On-chain disbursement failed: ${result.result.engine_result_message}`);
      }
    } catch (error) {
      console.error('CRITICAL ERROR during disbursement:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

   /**
   * Release collateral back to borrower when loan is fully repaid
   * @param {number} escrowSequence - Escrow sequence number
   * @param {string} borrowerAddress - Borrower's address to return collateral to
   * @returns {Promise<object>} Result of releasing the escrow
   */
  async releaseCollateral(escrowSequence, borrowerAddress) {
    await this.connect();
    try {
      const wallet = xrpl.Wallet.fromSeed(config.platformEscrowSecret);

      const escrowFinishTx = {
        TransactionType: 'EscrowFinish',
        Account: wallet.address,
        Owner: borrowerAddress,
        OfferSequence: escrowSequence
      };

      const prepared = await this.api.autofill(escrowFinishTx);

      const signed = wallet.sign(prepared);
      const txHash = signed.hash;

      console.log(`[INFO] Submitting escrow finish transaction with hash: ${txHash}`);

      const result = await this.api.submit(signed.tx_blob);

      if (result.result.engine_result === 'tesSUCCESS') {
        console.log('[SUCCESS] Escrow finish successful. Collateral released.');
        return { success: true, txHash };
      } else {
        throw new Error(`Escrow finish failed: ${result.result.engine_result_message}`);
      }
    } catch (error) {
      console.error('Error releasing collateral:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

module.exports = new XRPLService();