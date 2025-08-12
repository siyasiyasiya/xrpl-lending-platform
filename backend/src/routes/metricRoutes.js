const express = require('express');
const router = express.Router();
const loanService = require('../services/loanService');
const authMiddleware = require('../middlewares/auth');

// Get platform metrics
router.get('/dashboard', async (req, res) => {
  try {
    const metrics = await loanService.getMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

module.exports = router;