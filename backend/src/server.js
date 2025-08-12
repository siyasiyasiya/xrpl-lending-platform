const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/config');

// Import routes
const authRoutes = require('./routes/authRoutes');
const loanRoutes = require('./routes/loanRoutes');
const metricRoutes = require('./routes/metricRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/metrics', metricRoutes);
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