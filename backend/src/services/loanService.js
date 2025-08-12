const Loan = require('../models/Loan');
const User = require('../models/User');
const xrplService = require('./xrplService');
const creditScoreClient = require('./creditScoreClient');

class LoanService {
  /**
   * Calculate risk category based on PCA risk score
   * @param {number} pcaScore - The PCA risk score (0-100)
   * @returns {object} Risk category and appropriate loan terms
   */
  calculateRiskCategory(pcaScore) {
    // Risk categories based on provided PCA data
    // Note: For undercollateralized lending, we use much stricter criteria
    if (pcaScore <= 36.2) { // Very Low Risk mean
      return {
        category: 'Very Low Risk',
        interestRate: 0.12, // 12% - higher than traditional lending due to undercollateralization
        collateralRatio: 0.60, // Only 60% of loan needs to be collateralized
        maxLoanTerm: 90, // days
        maxLoanAmount: 1000, // More conservative amounts due to undercollateralization
        eligibleForUndercollateralized: true
      };
    } else if (pcaScore <= 44.5) { // Low Risk mean
      return {
        category: 'Low Risk',
        interestRate: 0.18, // 18%
        collateralRatio: 0.70, // 70% collateral required
        maxLoanTerm: 60, // days
        maxLoanAmount: 750,
        eligibleForUndercollateralized: true
      };
    } else if (pcaScore <= 56.5) { // Medium Risk mean
      return {
        category: 'Medium Risk',
        interestRate: 0.25, // 25%
        collateralRatio: 0.80, // 80% collateral required
        maxLoanTerm: 45, // days
        maxLoanAmount: 500,
        eligibleForUndercollateralized: true
      };
    } else if (pcaScore <= 74.7) { // High Risk mean
      return {
        category: 'High Risk',
        interestRate: 0.35, // 35%
        collateralRatio: 0.90, // 90% collateral required (almost fully collateralized)
        maxLoanTerm: 30, // days
        maxLoanAmount: 300,
        eligibleForUndercollateralized: true
      };
    } else {
      return {
        category: 'Very High Risk',
        interestRate: 0, // Not eligible for undercollateralized loans
        collateralRatio: 1.5, // Would require overcollateralization (not offering this product)
        maxLoanTerm: 0, // Not eligible
        maxLoanAmount: 0, // Not eligible
        eligibleForUndercollateralized: false
      };
    }
  }

  /**
   * Create a new undercollateralized loan application
   * @param {string} borrowerWalletAddress - Borrower's XRP wallet address
   * @param {number} amount - Requested loan amount
   * @param {number} term - Loan term in days
   * @param {number} collateralAmount - Proposed collateral amount (less than loan amount)
   * @returns {Promise<object>} Created loan object with risk assessment
   */
  async createLoanApplication(borrowerWalletAddress, amount, term, collateralAmount) {
    try {
      // Get or create user
      let user = await User.findOne({ walletAddress: borrowerWalletAddress });
      if (!user) {
        user = new User({ walletAddress: borrowerWalletAddress });
        await user.save();
      }

      // Get credit score - CRITICAL for undercollateralized lending
      let creditScore = user.creditScore;
      if (!creditScore || creditScore === 0) {
        creditScore = await creditScoreClient.getCreditScore(borrowerWalletAddress);
        user.creditScore = creditScore.risk_score;
        await user.save();
      };
      
      // Determine risk category and loan terms
      const riskProfile = this.calculateRiskCategory(pcaRiskScore);
      
      // Check if borrower is eligible for undercollateralized lending
      if (!riskProfile.eligibleForUndercollateralized) {
        throw new Error(`Your risk profile (${riskProfile.category}) does not qualify for undercollateralized lending.`);
      }
      
      // Validate loan parameters
      if (amount > riskProfile.maxLoanAmount) {
        throw new Error(`Loan amount exceeds maximum for your risk profile (${riskProfile.maxLoanAmount} XRP)`);
      }
      
      if (term > riskProfile.maxLoanTerm) {
        throw new Error(`Loan term exceeds maximum for your risk profile (${riskProfile.maxLoanTerm} days)`);
      }
      
      // Calculate minimum required collateral (which is less than the loan amount)
      const minRequiredCollateral = amount * riskProfile.collateralRatio;
      
      // For undercollateralized loans, we ensure:
      // 1. Collateral is less than loan amount (that's the point of undercollateralized)
      // 2. Collateral meets minimum requirement based on risk profile
      if (collateralAmount > amount) {
        throw new Error(`For undercollateralized loans, collateral (${collateralAmount} XRP) must be less than loan amount (${amount} XRP)`);
      }
      
      if (collateralAmount < minRequiredCollateral) {
        throw new Error(`Insufficient collateral. Minimum required for your risk profile: ${minRequiredCollateral} XRP (${riskProfile.collateralRatio * 100}% of loan amount)`);
      }

      // Create loan in PENDING status
      const newLoan = new Loan({
        borrower: borrowerWalletAddress,
        amount,
        collateralAmount,
        interestRate: riskProfile.interestRate,
        term,
        status: 'PENDING',
        createdAt: new Date()
      });

      await newLoan.save();
      
      return {
        loan: newLoan,
        riskProfile: {
          category: riskProfile.category,
          creditScore,
          collateralRatio: riskProfile.collateralRatio,
          undercollateralizedAmount: amount - collateralAmount
        }
      };
    } catch (error) {
      console.error('Error creating undercollateralized loan application:', error);
      throw error;
    }
  }

  /**
   * Approve an undercollateralized loan and initiate disbursement
   * @param {string} loanId - ID of the loan to approve
   * @returns {Promise<object>} Updated loan object
   */
  async approveLoan(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'PENDING') {
        throw new Error(`Cannot approve loan with status: ${loan.status}`);
      }

      // Create escrow for the partial collateral
      const escrowPayload = await xrplService.createCollateralEscrow(
        loan.borrower,
        loan.collateralAmount,
        loan.term
      );

      // Simulate escrow sequence and transaction hash for hackathon
      loan.escrowSequence = Math.floor(Math.random() * 1000000) + 1000000;
      loan.escrowTxHash = `ESCROW_TX_${Math.random().toString(36).substring(2, 15)}`;

      // Create disbursement transaction for the full loan amount
      // This is where the undercollateralized magic happens - we disburse more than we hold as collateral
      const disbursementPayload = await xrplService.createLoanDisbursement(
        loan.borrower,
        loan.amount, // Full amount, greater than collateral
        loan._id
      );

      // Simulate disbursement transaction hash
      loan.disbursementTxHash = `DISBURSE_TX_${Math.random().toString(36).substring(2, 15)}`;

      // Update loan status and timestamps
      loan.status = 'ACTIVE';
      loan.approvedAt = new Date();
      
      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + loan.term);
      loan.dueDate = dueDate;

      await loan.save();
      return loan;
    } catch (error) {
      console.error('Error approving undercollateralized loan:', error);
      throw error;
    }
  }

  /**
   * Reject a loan application
   * @param {string} loanId - ID of the loan to reject
   * @returns {Promise<object>} Updated loan object
   */
  async rejectLoan(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'PENDING') {
        throw new Error(`Cannot reject loan with status: ${loan.status}`);
      }

      loan.status = 'REJECTED';
      await loan.save();
      return loan;
    } catch (error) {
      console.error('Error rejecting loan:', error);
      throw error;
    }
  }

  /**
   * Process a loan repayment
   * @param {string} loanId - ID of the loan being repaid
   * @param {number} amount - Repayment amount
   * @param {string} txHash - Transaction hash of the repayment
   * @returns {Promise<object>} Updated loan object
   */
  async processRepayment(loanId, amount, txHash) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'ACTIVE') {
        throw new Error(`Cannot process repayment for loan with status: ${loan.status}`);
      }

      // Add repayment to history
      loan.repaymentHistory.push({
        amount,
        txHash,
        date: new Date()
      });

      // Calculate total repaid
      const totalRepaid = loan.repaymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate total owed (principal + interest)
      const totalOwed = loan.amount * (1 + loan.interestRate);

      // Check if loan is fully repaid
      if (totalRepaid >= totalOwed) {
        loan.status = 'REPAID';
        
        // Release collateral
        await xrplService.releaseCollateral(loan.escrowSequence, loan.borrower);
      }

      await loan.save();
      return loan;
    } catch (error) {
      console.error('Error processing repayment:', error);
      throw error;
    }
  }

  /**
   * Handle defaulted undercollateralized loans
   * @param {string} loanId - ID of the defaulted loan
   * @returns {Promise<object>} Updated loan object
   */
  async handleDefaultedLoan(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'ACTIVE') {
        throw new Error(`Cannot mark as defaulted: loan with status ${loan.status}`);
      }

      // Calculate how much was actually repaid
      const totalRepaid = loan.repaymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate remaining principal + interest
      const totalOwed = loan.amount * (1 + loan.interestRate);
      const remainingOwed = totalOwed - totalRepaid;
      
      // Calculate how much is covered by collateral and how much is actual loss
      const collateralValue = loan.collateralAmount; // In a real system, this might have changed with XRP price
      const uncoveredLoss = Math.max(0, remainingOwed - collateralValue);
      
      // Claim the collateral (partial coverage of the loan)
      // In real implementation, this would be an actual XRPL transaction
      const claimTxHash = `CLAIM_TX_${Math.random().toString(36).substring(2, 15)}`;
      
      // Update loan status
      loan.status = 'DEFAULTED';
      loan.defaultDetails = {
        totalOwed,
        totalRepaid,
        remainingOwed,
        collateralClaimed: collateralValue,
        uncoveredLoss,
        claimTxHash,
        defaultedAt: new Date()
      };
      
      await loan.save();
      
      // Update platform risk metrics (important for undercollateralized lending)
      // In a real implementation, you'd update a separate collection for risk analytics
      
      return loan;
    } catch (error) {
      console.error('Error handling defaulted loan:', error);
      throw error;
    }
  }

  /**
   * Get loans for a borrower
   * @param {string} borrowerWalletAddress - Borrower's wallet address
   * @returns {Promise<Array>} Array of loans
   */
  async getBorrowerLoans(borrowerWalletAddress) {
    try {
      return await Loan.find({ borrower: borrowerWalletAddress });
    } catch (error) {
      console.error('Error getting borrower loans:', error);
      throw error;
    }
  }

  /**
   * Get a loan by ID
   * @param {string} loanId - Loan ID
   * @returns {Promise<object>} Loan object
   */
  async getLoanById(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      return loan;
    } catch (error) {
      console.error('Error getting loan by ID:', error);
      throw error;
    }
  }

  /**
   * Get platform metrics specific to undercollateralized lending
   * @returns {Promise<object>} Platform metrics
   */
  async getPlatformMetrics() {
    try {
      // Get all loans
      const loans = await Loan.find();
      
      // Calculate basic metrics
      const totalLoans = loans.length;
      const activeLoans = loans.filter(loan => loan.status === 'ACTIVE').length;
      const repaidLoans = loans.filter(loan => loan.status === 'REPAID').length;
      const defaultedLoans = loans.filter(loan => loan.status === 'DEFAULTED').length;
      
      // Calculate financial metrics
      const totalLoanVolume = loans.reduce((sum, loan) => sum + loan.amount, 0);
      const totalCollateralLocked = loans
        .filter(loan => loan.status === 'ACTIVE')
        .reduce((sum, loan) => sum + loan.collateralAmount, 0);
      
      // Calculate undercollateralized amount (the trust-based lending amount)
      const totalUndercollateralizedAmount = loans
        .filter(loan => loan.status === 'ACTIVE')
        .reduce((sum, loan) => sum + (loan.amount - loan.collateralAmount), 0);
      
      // Calculate default rate (critical for undercollateralized lending)
      const defaultRate = totalLoans > 0 ? defaultedLoans / totalLoans : 0;
      
      // Calculate loss metrics (specific to undercollateralized lending)
      const totalLossAmount = loans
        .filter(loan => loan.status === 'DEFAULTED' && loan.defaultDetails)
        .reduce((sum, loan) => sum + (loan.defaultDetails.uncoveredLoss || 0), 0);
      
      // Calculate average collateralization ratio
      const avgCollateralRatio = loans.length > 0
        ? loans.reduce((sum, loan) => sum + (loan.collateralAmount / loan.amount), 0) / loans.length
        : 0;
      
      // Get distribution by risk category
      const users = await User.find();
      const riskDistribution = {
        'Very Low Risk': 0,
        'Low Risk': 0,
        'Medium Risk': 0,
        'High Risk': 0,
        'Very High Risk': 0
      };
      
      users.forEach(user => {
        if (user.creditScore) {
          const pcaScore = this.convertCreditScoreToPCA(user.creditScore);
          const { category } = this.calculateRiskCategory(pcaScore);
          riskDistribution[category]++;
        }
      });
      
      return {
        totalLoans,
        activeLoans,
        repaidLoans,
        defaultedLoans,
        totalLoanVolume,
        totalCollateralLocked,
        totalUndercollateralizedAmount,
        defaultRate,
        totalLossAmount,
        avgCollateralRatio,
        riskDistribution
      };
    } catch (error) {
      console.error('Error getting platform metrics:', error);
      throw error;
    }
  }
}

module.exports = new LoanService();