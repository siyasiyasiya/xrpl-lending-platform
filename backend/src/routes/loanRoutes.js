const express = require('express');
const router = express.Router();
const loanService = require('../services/loanService');
const authMiddleware = require('../middlewares/auth');

// Apply for a loan
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const { amount, collateralAmount, term } = req.body;
    const walletAddress = req.user.walletAddress;
    
    const loan = await loanService.applyForLoan(
      walletAddress, 
      amount, 
      collateralAmount,
      term
    );
    
    res.status(201).json(loan);
  } catch (error) {
    console.error('Error applying for loan:', error);
    res.status(500).json({ error: 'Failed to process loan application' });
  }
});

// Get loans for current user
router.get('/my-loans', authMiddleware, async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress;
    const loans = await loanService.getLoansByWallet(walletAddress);
    res.status(200).json(loans);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Get loan details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const loan = await loanService.getLoanById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    // Check if user is authorized to view this loan
    if (loan.borrower !== req.user.walletAddress) {
      return res.status(403).json({ error: 'Not authorized to view this loan' });
    }
    
    res.status(200).json(loan);
  } catch (error) {
    console.error('Error fetching loan details:', error);
    res.status(500).json({ error: 'Failed to fetch loan details' });
  }
});

// Make a repayment
router.post('/:id/repay', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const loanId = req.params.id;
    
    const loan = await loanService.getLoanById(loanId);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    // Check if user is authorized
    if (loan.borrower !== req.user.walletAddress) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updatedLoan = await loanService.processRepayment(loanId, amount);
    res.status(200).json(updatedLoan);
  } catch (error) {
    console.error('Error processing repayment:', error);
    res.status(500).json({ error: 'Failed to process repayment' });
  }
});

module.exports = router;