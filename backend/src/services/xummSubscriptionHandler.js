// xummSubscriptionHandler.js - Add this file to your project
const { XummSdk } = require('xumm-sdk');

class XummSubscriptionHandler {
  constructor(apiKey, apiSecret) {
    this.xumm = new XummSdk(apiKey, apiSecret);
    this.activeSubscriptions = new Map();
  }

  /**
   * Subscribe to a XUMM payload and handle events
   * @param {string} payloadId - The XUMM payload ID
   * @param {string} loanId - The loan ID
   * @param {Function} onSigned - Callback when transaction is signed
   * @param {Function} onRejected - Callback when transaction is rejected
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToPayload(payloadId, loanId, onSigned, onRejected) {
    try {
      console.log(`[${new Date().toISOString()}] Creating subscription for payload ${payloadId}, loan ${loanId}`);
      
      // Cancel existing subscription if any
      if (this.activeSubscriptions.has(loanId)) {
        console.log(`[${new Date().toISOString()}] Cleaning up previous subscription for loan ${loanId}`);
        this.activeSubscriptions.delete(loanId);
      }
      
      const subscription = await this.xumm.payload.subscribe(payloadId, async (event) => {
        console.log(`[${new Date().toISOString()}] Received XUMM event for loan ${loanId}:`, event);
        
        if ('opened' in event.data) {
          console.log(`[${new Date().toISOString()}] Payload ${payloadId} opened for loan ${loanId}`);
        }
        
        if ('signed' in event.data) {
          if (event.data.signed === true) {
            console.log(`[${new Date().toISOString()}] Payload ${payloadId} was signed for loan ${loanId}`);
            
            // Get transaction details
            const payload = await this.xumm.payload.get(payloadId);
            
            // Call the signed callback with payload data
            if (typeof onSigned === 'function') {
              await onSigned(loanId, { uuid: payloadId });
            }
          } else {
            console.log(`[${new Date().toISOString()}] Payload ${payloadId} was rejected for loan ${loanId}`);
            
            // Call the rejected callback
            if (typeof onRejected === 'function') {
              await onRejected(loanId);
            }
          }
          
          this.activeSubscriptions.delete(loanId);
          
          // Return the event to close the subscription
          return event;
        }
      });
      
      // Store subscription reference
      this.activeSubscriptions.set(loanId, subscription);
      
      return { success: true, subscription };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error subscribing to payload ${payloadId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if payload is signed
   * @param {string} payloadId - The XUMM payload ID
   * @returns {Promise<Object>} Payload data
   */
  async checkPayloadStatus(payloadId) {
    try {
      const payload = await this.xumm.payload.get(payloadId);
      return payload;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error checking payload ${payloadId}:`, error);
      throw error;
    }
  }
}

module.exports = XummSubscriptionHandler;