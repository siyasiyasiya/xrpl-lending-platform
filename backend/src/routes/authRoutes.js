const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Generate wallet connection request
router.post('/connect', async (req, res) => {
  try {
    const connectionRequest = await walletService.createConnectionRequest();
    res.status(200).json(connectionRequest);
  } catch (error) {
    console.error('Error creating connection request:', error);
    res.status(500).json({ error: 'Failed to create connection request' });
  }
});

// Verify wallet connection
router.post('/verify', async (req, res) => {
  try {
    const { payloadId } = req.body;
    const verification = await walletService.verifyConnection(payloadId);
    
    if (!verification.success) {
      return res.status(400).json({ error: 'Connection not verified' });
    }
    
    // Find or create user
    let user = await User.findOne({ walletAddress: verification.walletAddress });
    
    if (!user) {
      user = new User({
        walletAddress: verification.walletAddress
      });
      await user.save();
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { walletAddress: user.walletAddress },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      token,
      walletAddress: user.walletAddress
    });
  } catch (error) {
    console.error('Error verifying connection:', error);
    res.status(500).json({ error: 'Failed to verify connection' });
  }
});

module.exports = router;