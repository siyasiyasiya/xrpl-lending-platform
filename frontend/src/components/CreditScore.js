import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { creditScore } from '../utils/api';
import '../styles/components/CreditScore.css';

const CreditScore = () => {
  const { currentUser } = useAuth();
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("2025-08-12 19:23:10");
  
  const fetchCreditScore = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await creditScore.getCreditScore(currentUser.walletAddress);
      console.log("Raw API response:", data);
      
      if (data && typeof data.risk_score === 'number') {
        const riskScore = data.risk_score;
        setScore(riskScore);
        
        // Save the risk score to session storage
        sessionStorage.setItem('user_risk_score', riskScore.toString());
        
        // Calculate terms and save to session storage
        const currentTerms = getLoanTerms(riskScore);
        sessionStorage.setItem('user_loan_terms', JSON.stringify(currentTerms));
        
        // Update the timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
        setLastUpdated(timestamp);
        sessionStorage.setItem('risk_score_last_updated', timestamp);
        
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching risk score:', error);
      setError('Failed to load your risk score. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Check if there is cached data in session storage first
    const cachedScore = sessionStorage.getItem('user_risk_score');
    const cachedTerms = sessionStorage.getItem('user_loan_terms');
    const cachedTimestamp = sessionStorage.getItem('risk_score_last_updated');
    
    if (cachedScore && cachedTerms && cachedTimestamp) {
      setScore(parseFloat(cachedScore));
      setLastUpdated(cachedTimestamp);
      setLoading(false);
    } else {
      // If no cached data, fetch fresh data
      fetchCreditScore();
    }
  }, [currentUser]);
  
  // Get loan terms based on PCA score
  const getLoanTerms = (pcaScore) => {
    if (pcaScore <= 36.2) { // Very Low Risk mean
      return {
        category: 'Very Low Risk',
        interestRate: 0.12, // 12% - higher than traditional lending due to undercollateralization
        collateralRatio: 0.60, // Only 60% of loan needs to be collateralized
        maxLoanTerm: 90, // days
        maxLoanAmount: 1000, // More conservative amounts due to undercollateralization
        eligibleForUndercollateralized: true,
        color: '#4CAF50' // Green
      };
    } else if (pcaScore <= 44.5) { // Low Risk mean
      return {
        category: 'Low Risk',
        interestRate: 0.18, // 18%
        collateralRatio: 0.70, // 70% collateral required
        maxLoanTerm: 60, // days
        maxLoanAmount: 750,
        eligibleForUndercollateralized: true,
        color: '#8BC34A' // Light Green
      };
    } else if (pcaScore <= 56.5) { // Medium Risk mean
      return {
        category: 'Medium Risk',
        interestRate: 0.25, // 25%
        collateralRatio: 0.80, // 80% collateral required
        maxLoanTerm: 45, // days
        maxLoanAmount: 500,
        eligibleForUndercollateralized: true,
        color: '#FF9800' // Orange
      };
    } else if (pcaScore <= 80) { // High Risk mean
      return {
        category: 'High Risk',
        interestRate: 0.35, // 35%
        collateralRatio: 0.90, // 90% collateral required (almost fully collateralized)
        maxLoanTerm: 30, // days
        maxLoanAmount: 300,
        eligibleForUndercollateralized: true,
        color: '#F44336' // Red
      };
    } else {
      return {
        category: 'Very High Risk',
        interestRate: 0, // Not eligible for undercollateralized loans
        collateralRatio: 1.5, // Would require overcollateralization (not offering this product)
        maxLoanTerm: 0, // Not eligible
        maxLoanAmount: 0, // Not eligible
        eligibleForUndercollateralized: false,
        color: '#D32F2F' // Dark Red
      };
    }
  };
  
  const handleRetry = () => {
    // Clear session storage before retrying
    sessionStorage.removeItem('user_risk_score');
    sessionStorage.removeItem('user_loan_terms');
    sessionStorage.removeItem('risk_score_last_updated');
    fetchCreditScore();
  };
  
  if (!currentUser) return null;
  
  if (loading) return (
    <div className="credit-score-card loading-state">
      <h2>Risk Assessment</h2>
      <div className="loading-indicator">
        <div className="spinner"></div>
        <p>Analyzing your on-chain activity...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="credit-score-card error-state">
      <h2>Risk Assessment</h2>
      <div className="error-message">
        <div className="error-icon">!</div>
        <p>{error}</p>
        <button onClick={handleRetry} className="retry-button">
          Retry
        </button>
      </div>
      <div className="footer-info">
        <div className="user-info">Current User's Login: siyasiyasiya</div>
        <div className="last-updated">Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): {lastUpdated}</div>
      </div>
    </div>
  );
  
  // Get terms either from state or session storage
  const terms = score ? getLoanTerms(score) : JSON.parse(sessionStorage.getItem('user_loan_terms') || '{}');
  
  return (
    <div className="credit-score-card">
      <h2>Risk Assessment</h2>
      
      <div className="score-display" style={{ backgroundColor: terms.color }}>
        <span className="score-number">{score}</span>
      </div>
      
      <div className="risk-category" style={{ color: terms.color }}>
        {terms.category}
      </div>
      
      <div className="loan-terms">
        {terms.eligibleForUndercollateralized ? (
          <>
            <h3>Your Loan Terms</h3>
            <div className="terms-grid">
              <div className="term-item">
                <div className="term-label">Interest Rate</div>
                <div className="term-value">{(terms.interestRate * 100).toFixed(0)}%</div>
              </div>
              <div className="term-item">
                <div className="term-label">Collateral Required</div>
                <div className="term-value">{(terms.collateralRatio * 100).toFixed(0)}%</div>
              </div>
              <div className="term-item">
                <div className="term-label">Max Loan Term</div>
                <div className="term-value">{terms.maxLoanTerm} days</div>
              </div>
              <div className="term-item">
                <div className="term-label">Max Loan Amount</div>
                <div className="term-value">{terms.maxLoanAmount} XRP</div>
              </div>
            </div>
          </>
        ) : (
          <div className="not-eligible">
            <p>Not eligible for undercollateralized loans at this time.</p>
            <p>Please use fully collateralized loans instead.</p>
          </div>
        )}
      </div>
      
      <div className="footer-info">
        <div className="last-updated">Last Updated: {lastUpdated}</div>
      </div>
    </div>
  );
};

export default CreditScore;