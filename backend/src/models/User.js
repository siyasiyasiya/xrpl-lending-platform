const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true
  },
  creditScore: {
    type: Number,
    default: null
  },
  lastScoreUpdate: {
    type: Date,
    default: null
  },
  loans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);