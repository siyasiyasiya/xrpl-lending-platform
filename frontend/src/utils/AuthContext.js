import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth } from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const walletAddress = localStorage.getItem('walletAddress');
    
    if (token && walletAddress) {
      setCurrentUser({ walletAddress });
    }
    
    setLoading(false);
  }, []);

  const connectWallet = async () => {
    try {
      const connectionRequest = await auth.connectWallet();
      return connectionRequest;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  };

  const verifyConnection = async (payloadId) => {
    try {
      const userData = await auth.verifyConnection(payloadId);
      
      // Save token and wallet address
      localStorage.setItem('token', userData.token);
      localStorage.setItem('walletAddress', userData.walletAddress);
      
      setCurrentUser({ walletAddress: userData.walletAddress });
      return userData;
    } catch (error) {
      console.error('Error verifying connection:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('walletAddress');
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    connectWallet,
    verifyConnection,
    logout,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);