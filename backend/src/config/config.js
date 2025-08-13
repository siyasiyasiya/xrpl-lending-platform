require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5050,
  jwtSecret: process.env.JWT_SECRET,
  mlApiUrl: process.env.ML_API_URL,
  xummApiKey: process.env.XUMM_API_KEY,
  xummApiSecret: process.env.XUMM_API_SECRET,
  mongoURI: process.env.MONGODB_URI,
  rippleNode: process.env.RIPPLE_NODE,
  platformEscrowAddress: process.env.PLATFORM_ESCROW_ADDRESS,
  platformTreasuryAddress: process.env.PLATFORM_TREASURY_ADDRESS,
  platformRepaymentAddress: process.env.PLATFORM_REPAYMENT_ADDRESS,
  platformEscrowSecret: process.env.PLATFORM_ESCROW_SECRET,
  platformTreasurySecret: process.env.PLATFORM_TREASURY_SECRET,
  platformRepaymentSecret: process.env.PLATFORM_REPAYMENT_SECRET,
};