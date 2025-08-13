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

  /**
   * Claim collateral from escrow on loan default
   * @param {string} borrowerAddress - Borrower's address (escrow owner)
   * @param {number} escrowSequence - Sequence number of the escrow to claim
   * @returns {Promise<object>} Result of claiming the escrow
   */
  async claimCollateralEscrow(borrowerAddress, escrowSequence) {
    await this.connect();
    try {
      console.log(`[XRPL] Attempting to claim escrow from ${borrowerAddress}, sequence ${escrowSequence}`);
      
      // Create a wallet instance from platform secret
      const wallet = xrpl.Wallet.fromSeed(config.platformEscrowSecret);

      // First, verify the escrow exists and is claimable
      const accountEscrows = await this.api.request({
        command: 'account_objects',
        account: borrowerAddress,
        type: 'escrow'
      });
      
      console.log(`[XRPL] Found ${accountEscrows.result?.account_objects?.length || 0} escrows for account`);
      
      // Find the specific escrow with the given sequence
      const escrow = accountEscrows.result?.account_objects?.find(obj => 
        obj.OwnerNode === escrowSequence.toString() || 
        obj.PreviousTxnLgrSeq === escrowSequence
      );
      
      if (!escrow) {
        throw new Error(`Escrow with sequence ${escrowSequence} not found for borrower ${borrowerAddress}`);
      }
      
      console.log(`[XRPL] Found escrow: ${JSON.stringify(escrow)}`);
      
      // Prepare the EscrowFinish transaction
      const escrowFinishTx = {
        TransactionType: 'EscrowFinish',
        Account: wallet.address,
        Owner: borrowerAddress,
        OfferSequence: escrowSequence,
        Flags: 0 // Standard flags
      };

      // Add Condition and Fulfillment if they exist in the escrow
      if (escrow.Condition) {
        escrowFinishTx.Condition = escrow.Condition;
        // In a real system, you'd need to provide the Fulfillment
        // This is just a placeholder
        escrowFinishTx.Fulfillment = ''; 
      }
      
      console.log(`[XRPL] Preparing EscrowFinish transaction`);
      const prepared = await this.api.autofill(escrowFinishTx);

      // Sign the prepared transaction
      console.log(`[XRPL] Signing transaction with wallet`);
      const signed = wallet.sign(prepared);
      const txHash = signed.hash;

      console.log(`[XRPL] Submitting escrow finish transaction with hash: ${txHash}`);

      // Submit the signed transaction blob
      const result = await this.api.submit(signed.tx_blob);
      console.log(`[XRPL] Submission result: ${JSON.stringify(result.result)}`);

      if (result.result.engine_result === 'tesSUCCESS') {
        console.log('[XRPL] Escrow claim successful. Collateral claimed.');
        return { 
          success: true, 
          txHash,
          result: result.result
        };
      } else if (result.result.engine_result === 'terQUEUED') {
        // Transaction is queued - this is usually fine
        console.log('[XRPL] Escrow claim queued for processing.');
        return { 
          success: true, 
          txHash,
          status: 'queued',
          result: result.result
        };
      } else {
        throw new Error(`Escrow claim failed: ${result.result.engine_result_message}`);
      }
    } catch (error) {
      console.error('Error claiming escrow collateral:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
  
  /**
   * Check if a borrower has any unclaimed/expired escrows
   * @param {string} borrowerAddress - Borrower's XRP address
   * @returns {Promise<Array>} Array of eligible escrows
   */
  async checkForUnclaimedEscrows(borrowerAddress) {
    await this.connect();
    try {
      // Get all escrows where the borrower is the owner
      const accountEscrows = await this.api.request({
        command: 'account_objects',
        account: borrowerAddress,
        type: 'escrow'
      });
      
      const now = new Date();
      const rippleEpochOffset = 946684800;
      const currentRippleTime = Math.floor(now.getTime() / 1000) - rippleEpochOffset;
      
      // Filter for escrows that are past their FinishAfter time
      const claimableEscrows = accountEscrows.result?.account_objects?.filter(escrow => {
        return escrow.FinishAfter && escrow.FinishAfter < currentRippleTime;
      }) || [];
      
      return claimableEscrows;
    } catch (error) {
      console.error('Error checking for unclaimed escrows:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

module.exports = new XRPLService();