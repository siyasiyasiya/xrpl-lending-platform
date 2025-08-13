const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/config');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/authRoutes');
const loanRoutes = require('./routes/loanRoutes');
const metricRoutes = require('./routes/metricRoutes');
const creditRoutes = require('./routes/creditRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/metrics', metricRoutes);
app.use('/api/credit', creditRoutes);
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'API is working!' });
  });

mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// For hackathon MVP, skipping the DB connection and just run the server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Starting daily check for overdue loans');
  try {
    const processedLoans = await loanService.checkForOverdueLoans();
    console.log(`[CRON] Processed ${processedLoans.length} overdue loans`);
    
    // Log details of processed loans
    if (processedLoans.length > 0) {
      processedLoans.forEach(loan => {
        console.log(`[CRON] Loan ${loan._id} for borrower ${loan.borrower} marked as defaulted at ${loan.defaultDetails.defaultedAt}`);
      });
    }
  } catch (error) {
    console.error('[CRON] Error in daily overdue loan check:', error);
  }
});