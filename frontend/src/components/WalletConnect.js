import React, { useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import QRCode from 'react-qr-code';
import '../styles/components/WalletConnect.css';

const WalletConnect = () => {
  const { connectWallet, verifyConnection } = useAuth();
  const [connectionData, setConnectionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await connectWallet();
      setConnectionData(data);
      
      // Start polling for connection status
      checkConnectionStatus(data.payloadId);
    } catch (error) {
      setError('Failed to initiate wallet connection');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async (payloadId) => {
    try {
      // Simple polling - in production you'd use the WebSocket URL provided
      const checkInterval = setInterval(async () => {
        try {
          await verifyConnection(payloadId);
          clearInterval(checkInterval);
          // Successfully verified, context will update user state
        } catch (error) {
          // Still waiting for user to approve in XUMM
          console.log('Waiting for user approval...');
        }
      }, 2000);
      
      // Stop checking after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!localStorage.getItem('token')) {
          setError('Connection request expired. Please try again.');
          setConnectionData(null);
        }
      }, 120000);
    } catch (error) {
      setError('Failed to verify wallet connection');
      console.error(error);
    }
  };

  return (
    <div className="wallet-connect">
      <h2>Connect Your XRPL Wallet</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      {!connectionData ? (
        <button 
          onClick={handleConnect} 
          disabled={loading}
          className="connect-button"
        >
          {loading ? 'Connecting...' : 'Connect with XUMM'}
        </button>
      ) : (
        <div className="qr-container">
          <p>Scan this QR code with your XUMM app</p>
          <QRCode value={connectionData.qrUrl} size={256} />
          <p className="helper-text" style={{marginTop: '2rem'}}>
            Once approved, you'll be automatically logged in
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;