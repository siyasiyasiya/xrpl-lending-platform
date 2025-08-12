const { XummSdk } = require('xumm-sdk');
const config = require('../config/config');

class WalletService {
  constructor() {
    this.xumm = new XummSdk(config.xummApiKey, config.xummApiSecret);
  }

  async createConnectionRequest() {
    const payload = await this.xumm.payload.create({
      txjson: {
        TransactionType: 'SignIn'
      }
    });

    return {
      qrUrl: payload.next.always,
      websocketUrl: payload.refs.websocket_status,
      payloadId: payload.uuid
    };
  }

  async verifyConnection(payloadId) {
    const payloadStatus = await this.xumm.payload.get(payloadId);
    
    if (payloadStatus.meta.signed) {
      return {
        success: true,
        walletAddress: payloadStatus.response.account
      };
    }
    
    return {
      success: false
    };
  }
}

module.exports = new WalletService();