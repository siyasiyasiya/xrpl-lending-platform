require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5050,
  jwtSecret: process.env.JWT_SECRET,
  mlApiUrl: process.env.ML_API_URL,
  xummApiKey: process.env.XUMM_API_KEY,
  xummApiSecret: process.env.XUMM_API_SECRET,
  mongoURI: process.env.MONGODB_URI
};