const axios = require('axios');
const config = require('../config/config');

class CreditScoreClient {
  constructor() {
    this.apiBaseUrl = config.mlApiUrl;
  }

  async getCreditScore(walletAddress) {
    if (!walletAddress) {
        throw new Error("Wallet address cannot be empty.");
    }

    try {
      const response = await axios.get(`${this.apiBaseUrl}/score`, {
        params: { address: walletAddress }
      });
      return response.data;
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Error fetching credit score (API responded with error):', {
              status: error.response.status,
              data: error.response.data
            });
            throw new Error(`Failed to retrieve credit score. API responded with status ${error.response.status}.`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Error fetching credit score (No response from API):', error.request);
            throw new Error('Failed to retrieve credit score. No response from the API server.');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error fetching credit score (Request setup failed):', error.message);
            throw new Error('Failed to retrieve credit score due to a client-side error.');
        }
    }
  }
}

module.exports = new CreditScoreClient();