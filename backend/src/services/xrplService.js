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

  // 3. CHANGE: This is the fully rewritten disburseLoan method
  async disburseLoan(borrowerAddress, loanAmount) {
    await this.connect();
    try {
      // Create a wallet instance from your secret. This is where signing power comes from.
      const wallet = xrpl.Wallet.fromSeed(config.platformEscrowSecret);

      const paymentTx = {
        TransactionType: 'Payment',
        // Best practice: Use the address derived from the wallet to prevent mismatches
        Account: wallet.address,
        Amount: xrpl.xrpToDrops(loanAmount), // Use the utility for safety and clarity
        Destination: borrowerAddress,
      };

      // Prepare the transaction (autofills sequence number, fees, etc.)
      const prepared = await this.api.autofill(paymentTx);

      // Sign the prepared transaction using the wallet
      const signed = wallet.sign(prepared);
      const txHash = signed.hash;

      console.log(`[INFO] Submitting disbursement transaction with hash: ${txHash}`);

      // Submit the signed transaction blob
      const result = await this.api.submit(signed.tx_blob);

      // Check the final result
      if (result.result.engine_result === 'tesSUCCESS') {
        console.log('[SUCCESS] Disbursement successful.');
        return { success: true, txHash: txHash };
      } else {
        throw new Error(`On-chain disbursement failed: ${result.result.engine_result_message}`);
      }
    } catch (error) {
      console.error('CRITICAL ERROR during disbursement:', error);
      throw error; // Re-throw to ensure the calling service knows about the failure
    } finally {
      // Ensure we always disconnect
      await this.disconnect();
    }
  }
}

module.exports = new XRPLService();