const Loan = require('../models/Loan');
const User = require('../models/User');
const creditScoreClient = require('./creditScoreClient');

class LoanService {
  async calculateInterestRate(creditScore) {
    if (creditScore >= 800) return 0.05; // 5%
    if (creditScore >= 700) return 0.08; // 8%
    if (creditScore >= 600) return 0.12; // 12%
    if (creditScore >= 500) return 0.18; // 18%
    return 0.25; // 25% for very low scores
  }
  
  async applyForLoan(walletAddress, amount, collateralAmount, termDays = 30) {
    // Get credit score
    const creditScoreData = await creditScoreClient.getCreditScore(walletAddress);
    
    // Calculate interest rate based on credit score
    const interestRate = await this.calculateInterestRate(creditScoreData.score);
    
    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termDays);
    
    // Create new loan
    const loan = new Loan({
      borrower: walletAddress,
      amount,
      collateralAmount,
      interestRate,
      term: termDays,
      dueDate,
      status: 'PENDING'
    });
    
    await loan.save();
    
    // Update user's credit score and add loan reference
    await User.findOneAndUpdate(
      { walletAddress },
      { 
        $set: { creditScore: creditScoreData.score, lastScoreUpdate: new Date() },
        $push: { loans: loan._id }
      }
    );
    
    return loan;
  }
  
  async getLoansByWallet(walletAddress) {
    return Loan.find({ borrower: walletAddress });
  }
  
  async getLoanById(loanId) {
    return Loan.findById(loanId);
  }
  
  async updateLoanStatus(loanId, status) {
    return Loan.findByIdAndUpdate(
      loanId,
      { $set: { status } },
      { new: true }
    );
  }
  
  async processRepayment(loanId, amount) {
    const loan = await Loan.findById(loanId);
    
    if (!loan) {
      throw new Error('Loan not found');
    }
    
    // Add repayment to history
    loan.repaymentHistory.push({ amount });
    
    // Calculate total repaid
    const totalRepaid = loan.repaymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Check if loan is fully repaid
    if (totalRepaid >= loan.amount * (1 + loan.interestRate)) {
      loan.status = 'REPAID';
    }
    
    await loan.save();
    return loan;
  }
  
  async getMetrics() {
    const totalLoans = await Loan.countDocuments();
    const activeLoans = await Loan.countDocuments({ status: 'ACTIVE' });
    const defaultedLoans = await Loan.countDocuments({ status: 'DEFAULTED' });
    
    // Calculate default rate
    const defaultRate = totalLoans > 0 ? defaultedLoans / totalLoans : 0;
    
    // Get average credit score
    const users = await User.find({ creditScore: { $ne: null } });
    const totalCreditScore = users.reduce((sum, user) => sum + user.creditScore, 0);
    const averageCreditScore = users.length > 0 ? totalCreditScore / users.length : 0;
    
    // Count loans by risk category based on interest rate
    const lowRiskLoans = await Loan.countDocuments({ interestRate: { $lte: 0.08 } });
    const mediumRiskLoans = await Loan.countDocuments({ 
      interestRate: { $gt: 0.08, $lte: 0.18 } 
    });
    const highRiskLoans = await Loan.countDocuments({ interestRate: { $gt: 0.18 } });
    
    return {
      totalLoans,
      activeLoans,
      defaultRate,
      poolBalance: 10000, // Mock value for hackathon
      averageCreditScore,
      loansByRiskCategory: {
        low: lowRiskLoans,
        medium: mediumRiskLoans,
        high: highRiskLoans
      }
    };
  }
}

module.exports = new LoanService();