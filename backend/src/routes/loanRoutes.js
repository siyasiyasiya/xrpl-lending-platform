const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const loanService = require('../services/loanService');
const { check } = require('express-validator');
const validate = require('../middlewares/validate');

// Apply for a loan
router.post('/apply', [
    auth,
    check('amount', 'Amount is required').isNumeric(),
    check('term', 'Term in days is required').isNumeric(),
    check('collateralAmount', 'Collateral amount is required').isNumeric(),
    validate
  ], async (req, res) => {
    try {
      const { amount, term, collateralAmount } = req.body;
      
      // Ensure collateral is less than loan amount (undercollateralized check)
      if (parseFloat(collateralAmount) >= parseFloat(amount)) {
        return res.status(400).json({ 
          success: false, 
          message: 'For undercollateralized loans, collateral must be less than loan amount' 
        });
      }
      
      const result = await loanService.createLoanApplication(
        req.user.walletAddress,
        amount,
        term,
        collateralAmount
      );
      
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.post('/:id/execute', auth, async (req, res) => {
    try {
      const { payloadId } = req.body;
      const loanId = req.params.id;
      const walletAddress = req.user.walletAddress;
  
      if (!payloadId) {
        return res.status(400).json({ message: 'Payload ID is required.' });
      }
  
      const activatedLoan = await loanService.executeLoan(loanId, payloadId, walletAddress);
      res.status(200).json({ success: true, data: activatedLoan });
    } catch (error) {
      console.error(`Error executing loan ${req.params.id}:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /**
   * Subscribe to loan signature events
   */
  router.post('/:id/subscribe', async (req, res) => {
    try {
      const loanId = req.params.id;
      
      // Optional: Add authorization check
      // const loan = await loanService.getLoanById(loanId);
      // if (loan.borrower !== req.user.walletAddress) {
      //   return res.status(403).json({ success: false, message: 'Not authorized' });
      // }
      
      const result = await loanService.subscribeToLoanSignature(loanId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Subscription created successfully' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: result.error 
        });
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  /**
   * Verify loan signature manually
   */
  router.post('/:id/verify', async (req, res) => {
    try {
      const loanId = req.params.id;
      const result = await loanService.verifyLoanSignature(loanId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          loan: result.loan 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: result.message,
          payloadStatus: result.payloadStatus 
        });
      }
    } catch (error) {
      console.error('Error verifying signature:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

// Get loans for current user
router.get('/my-loans', auth, async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress;
    const loans = await loanService.getBorrowerLoans(walletAddress);
    res.status(200).json(loans);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Get loan details
router.get('/:id', auth, async (req, res) => {
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

// Create a repayment request (generates XUMM payload)
router.post('/:id/repay', [
  auth,
  check('amount', 'Amount is required').isNumeric(),
  validate
], async (req, res) => {
  try {
    const { amount } = req.body;
    const loanId = req.params.id;
    const walletAddress = req.user.walletAddress;
    
    // Create repayment request and get XUMM payload
    const result = await loanService.createRepaymentRequest(
      loanId, 
      parseFloat(amount),
      walletAddress
    );
    
    res.status(200).json({
      success: true,
      repayment: result.repayment,
      payload: result.payload
    });
  } catch (error) {
    console.error('Error creating repayment request:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Subscribe to repayment signature events
router.post('/:id/repayments/:repaymentId/subscribe', auth, async (req, res) => {
  try {
    const loanId = req.params.id;
    const repaymentId = req.params.repaymentId;
    
    // Optional authorization check
    const loan = await loanService.getLoanById(loanId);
    if (loan.borrower !== req.user.walletAddress) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to subscribe to this repayment' 
      });
    }
    
    const result = await loanService.subscribeToRepaymentSignature(loanId, repaymentId);
    
    res.json({
      success: true,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    console.error('Error subscribing to repayment:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manual verification of repayment (for hackathon/testing)
router.post('/:id/repayments/:repaymentId/verify', auth, async (req, res) => {
  try {
    const loanId = req.params.id;
    const repaymentId = req.params.repaymentId;
    
    const result = await loanService.verifyRepaymentSignature(loanId, repaymentId);
    
    if (result.success) {
      res.json({
        success: true,
        loan: result.loan,
        txHash: result.txHash,
        isFullyRepaid: result.isFullyRepaid
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error verifying repayment:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


module.exports = router;