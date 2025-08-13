const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  borrower: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  collateralAmount: {
    type: Number,
    required: true
  },
  interestRate: {
    type: Number,
    required: true
  },
  term: {
    type: Number, // in days
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'REPAID', 'DEFAULTED'],
    default: 'PENDING'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  collateralTxHash: String,
  escrowSequence: Number,
  escrowPayloadId: String,
  repaymentTxHash: String,
  remainingBalance: Number,
  repayments: [{
    amount: Number,
    txHash: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
});

module.exports = mongoose.model('Loan', loanSchema);