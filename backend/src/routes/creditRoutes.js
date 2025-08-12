const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const User = require('../models/User');
const creditScoreClient = require('../services/creditScoreClient');

// Get credit score for a wallet address
router.get('/credit-score', async (req, res) => {
  try {
    const address = req.query.address;
    
    if (!address) {
      return res.status(400).json({ message: 'Wallet address is required' });
    }
    
    // Find existing user
    let user = await User.findOne({ walletAddress: address });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    try {
      // Call the ML API through the client
      const scoreData = await creditScoreClient.getCreditScore(address);
      
      // Update user's score in database
      user.creditScore = scoreData.score;
      user.lastScoreUpdate = Date.now();
      await user.save();
      
      // Return the data from the ML API directly
      res.json(scoreData);
      
    } catch (apiError) {
      console.error('ML API error:', apiError);
      
      // If the ML API fails, use the existing score if available
      if (user.creditScore) {
        // Return cached score with fallback data
        return res.json({
          score: user.creditScore,
          cached: true,
          lastUpdated: user.lastScoreUpdate
        });
      }
      
      // No cached score available, return error
      return res.status(503).json({ message: 'Credit scoring service unavailable' });
    }
  } catch (error) {
    console.error('Error in credit-score endpoint:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;