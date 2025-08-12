const { RippleAPI } = require('ripple-lib');
const { XummSdk } = require('xumm-sdk');
const config = require('../config/config');

class XRPLService {
  constructor() {
    this.api = new RippleAPI({ server: config.rippleNode });
    this.xumm = new XummSdk(config.xummApiKey, config.xummApiSecret);
  }
  
  async connect() {
    if (!this.api.isConnected()) {
      await this.api.connect();
    }
  }
  
  // Wallet connection via XUMM (already implemented)
  
  // Collateral escrow methods
  async createCollateralEscrow(walletAddress, collateralAmount, loanTermInDays) {
    await this.connect();
    const loanDurationInSeconds = loanTermInDays * 86400;
    const releaseDate = Math.floor(Date.now() / 1000) + loanDurationInSeconds;
    
    const escrowCreateTx = {
      TransactionType: 'EscrowCreate',
      Account: walletAddress,
      Amount: this.api.xrpToDrops(collateralAmount.toString()),
      FinishAfter: releaseDate,
      Destination: config.platformEscrowAddress
    };
    
    const payload = await this.xumm.payload.create({
      txjson: escrowCreateTx,
      custom_meta: {
        instruction: 'Please sign to lock your collateral in escrow',
        blob: { loanId: 'LOAN_ID_HERE' }
      }
    });
    
    return payload;
  }
  
  // Loan disbursement
  async createLoanDisbursement(borrowerAddress, loanAmount, loanId) {
    await this.connect();
    
    const paymentTx = {
      TransactionType: 'Payment',
      Account: config.platformTreasuryAddress,
      Destination: borrowerAddress,
      Amount: this.api.xrpToDrops(loanAmount.toString()),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(`Loan ID: ${loanId}`).toString('hex')
        } 
      }]
    };
    
    // This would be signed by your platform's treasury account
    // For a hackathon, you might simulate this with mock data
    return paymentTx;
  }
  
  // Monitor for repayments
  async setupRepaymentMonitoring() {
    await this.connect();
    
    this.api.connection.on('transaction', (tx) => {
      if (tx.transaction.TransactionType === 'Payment' && 
          tx.transaction.Destination === config.platformRepaymentAddress) {
        
        const amount = this.api.dropsToXrp(tx.transaction.Amount);
        const sender = tx.transaction.Account;
        
        // Find which loan this repayment belongs to
        // Update loan repayment status in your database
        console.log(`Received repayment of ${amount} XRP from ${sender}`);
      }
    });
  }
  
  // Release collateral after successful repayment
  async releaseCollateral(escrowSequence, borrowerAddress) {
    await this.connect();
    
    const finishTx = {
      TransactionType: 'EscrowFinish',
      Account: config.platformEscrowAddress,
      Owner: borrowerAddress,
      OfferSequence: escrowSequence
    };
    
    // This would need to be signed by your platform's escrow account
    return finishTx;
  }
  
  // Calculate credit score based on XRP Ledger history
  async calculateCreditScore(walletAddress) {
    await this.connect();
    
    try {
      const accountInfo = await this.api.getAccountInfo(walletAddress);
      const txHistory = await this.api.getTransactions(walletAddress, {
        limit: 100,
        earliestFirst: false
      });
      
      // Simple scoring algorithm for demo purposes
      let score = 500; // Base score
      
      // Account age (based on sequence number)
      score += Math.min(accountInfo.sequence / 10, 100);
      
      // Account balance
      const balance = parseFloat(accountInfo.xrpBalance);
      score += Math.min(balance / 100, 100);
      
      // Transaction history
      score += Math.min(txHistory.length * 2, 150);
      
      // Cap at 850
      return Math.min(Math.round(score), 850);
    } catch (error) {
      console.error('Error calculating credit score:', error);
      return 0;
    }
  }
}

module.exports = new XRPLService();