import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import axios from 'axios';
import '../styles/components/CreditScore.css';

const CreditScore = () => {
  const { currentUser } = useAuth();
  const [creditData, setCreditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchCreditScore = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_ML_API_URL}/credit-score`, {
          params: { wallet_address: currentUser.walletAddress }
        });
        
        setCreditData(response.data);
      } catch (error) {
        console.error('Error fetching credit score:', error);
        setError('Failed to load your credit score');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCreditScore();
  }, [currentUser]);
  
  if (!currentUser) return null;
  if (loading) return <div className="loading">Loading your credit score...</div>;
  if (error) return <div className="error-message">{error}</div>;
  
  // Function to determine risk level and color
  const getRiskLevel = (score) => {
    if (score >= 750) return { level: 'Low Risk', color: '#4CAF50' };
    if (score >= 600) return { level: 'Medium Risk', color: '#FF9800' };
    return { level: 'High Risk', color: '#F44336' };
  };
  
  const { level, color } = getRiskLevel(creditData.score);
  
  return (
    <div className="credit-score-card">
      <h2>Your Credit Score</h2>
      
      <div className="score-display" style={{ backgroundColor: color }}>
        <span className="score-number">{creditData.score}</span>
      </div>
      
      <div className="score-details">
        <h3>Risk Level: {level}</h3>
        <p>Based on your on-chain activity and wallet history</p>
        
        <div className="score-factors">
          <h4>Key Factors</h4>
          <ul>
            {creditData.factors?.map((factor, index) => (
              <li key={index}>
                <span className="factor-name">{factor.name}:</span> {factor.value}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="credit-suggestions">
          <h4>Suggestions to Improve</h4>
          <ul>
            {creditData.suggestions?.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreditScore;