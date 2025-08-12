import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import '../styles/components/LoanApplication.css';

const LoanApplication = ({ onLoanCreated }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    amount: '',
    term: 30,
    collateralAmount: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [riskScore, setRiskScore] = useState(null);
  const [riskProfile, setRiskProfile] = useState(null);
  const [collateralRatio, setCollateralRatio] = useState(0);
  const [timestamp, setTimestamp] = useState("2025-08-12 19:38:21");
  const [isWaitingForData, setIsWaitingForData] = useState(true);

  // Check for risk data in session storage - with polling if needed
  useEffect(() => {
    // Initial check
    checkStorageForRiskData();
    
    // Set up polling if data isn't available yet
    const intervalId = setInterval(() => {
      const dataFound = checkStorageForRiskData();
      if (dataFound) {
        clearInterval(intervalId);
      }
    }, 1000); // Check every second
    
    // Clean up the interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Check session storage and retrieve risk data if available
  const checkStorageForRiskData = () => {
    const cachedScore = sessionStorage.getItem('user_risk_score');
    const cachedTerms = sessionStorage.getItem('user_loan_terms');
    const cachedTimestamp = sessionStorage.getItem('risk_score_last_updated');
    
    if (cachedScore && cachedTerms) {
      const score = parseFloat(cachedScore);
      setRiskScore(score);
      setRiskProfile(JSON.parse(cachedTerms));
      
      if (cachedTimestamp) {
        setTimestamp(cachedTimestamp);
      }
      
      setIsWaitingForData(false);
      return true;
    }
    
    return false;
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Calculate collateral ratio whenever amount or collateralAmount changes
    if (name === 'amount' || name === 'collateralAmount') {
      const amount = name === 'amount' ? parseFloat(value) : parseFloat(formData.amount);
      const collateral = name === 'collateralAmount' ? parseFloat(value) : parseFloat(formData.collateralAmount);
      
      if (amount && collateral) {
        setCollateralRatio(collateral / amount);
      } else {
        setCollateralRatio(0);
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Validate undercollateralization
      if (parseFloat(formData.collateralAmount) >= parseFloat(formData.amount)) {
        throw new Error('For undercollateralized loans, collateral must be less than loan amount');
      }
      
      // Check minimum collateral based on risk profile
      if (riskProfile && parseFloat(formData.collateralAmount) < parseFloat(formData.amount) * riskProfile.collateralRatio) {
        throw new Error(`Minimum collateral required: ${(parseFloat(formData.amount) * riskProfile.collateralRatio).toFixed(2)} XRP (${riskProfile.collateralRatio * 100}% of loan amount)`);
      }
      
      const loanApplicationData = {
        ...formData,
        walletAddress: currentUser.walletAddress
      };

      console.log('Submitting loan application:', loanApplicationData);
      
      // Submit loan application
      const response = await api.post('/loans/apply', loanApplicationData);

      console.log('Loan application response:', response);
      
      // Notify parent component
      if (onLoanCreated) {
        onLoanCreated();
      }
      
      // Clear form
      setFormData({
        amount: '',
        term: 30,
        collateralAmount: ''
      });
      
      // Show success message
      setError('');
      alert('Loan application submitted successfully!');
      
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while waiting for risk data from CreditScore component
  if (isWaitingForData) {
    return (
      <div className="loan-application-card loading-state">
        <h2>Apply for Undercollateralized Loan</h2>
        <div className="waiting-for-data">
          <div className="spinner"></div>
          <p>Loading your risk profile data...</p>
        </div>
        <div className="footer-info">
          <div className="user-info">Current User's Login: siyasiyasiya</div>
          <div className="last-updated">Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): {timestamp}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="loan-application-card">
      <h2>Apply for Undercollateralized Loan</h2>
      
      {riskProfile && riskProfile.eligibleForUndercollateralized === false ? (
        <div className="ineligible-notice">
          <h3>Not Eligible for Undercollateralized Lending</h3>
          <p>Your current risk profile does not qualify for undercollateralized loans.</p>
          <p>To improve your eligibility, consider building your XRP Ledger transaction history and maintaining a positive repayment record.</p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Loan Amount (XRP)</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="Enter"
                min="1"
                max={riskProfile?.maxLoanAmount || 1000}
                required
              />
              <div className="form-help">
                Maximum: {riskProfile?.maxLoanAmount || '1000'} XRP based on your risk profile
              </div>
            </div>
            
            <div className="form-group">
              <label>Collateral Amount (XRP)</label>
              <input
                type="number"
                name="collateralAmount"
                value={formData.collateralAmount}
                onChange={handleChange}
                placeholder="Enter"
                min={formData.amount ? (parseFloat(formData.amount) * (riskProfile?.collateralRatio || 0.6)).toFixed(2) : '1'}
                max={formData.amount ? (parseFloat(formData.amount) - 0.01).toFixed(2) : '1000'}
                required
              />
              <div className="form-help">
                For undercollateralized loans, collateral must be less than loan amount
                {formData.amount && (
                  <div className="min-max-info">
                    <span>Min: {(parseFloat(formData.amount) * (riskProfile?.collateralRatio || 0.6)).toFixed(2)} XRP</span>
                    <span> | Max: {(parseFloat(formData.amount) - 0.01).toFixed(2)} XRP</span>
                  </div>
                )}
              </div>
              
              {/* Simplified collateral ratio display */}
              {collateralRatio > 0 && (
                <div className="collateral-info">
                  <div className="ratio-summary">
                    <span>Current Collateral Ratio: {(collateralRatio * 100).toFixed(0)}%</span>
                    <span>Undercollateralized: {(parseFloat(formData.amount) - parseFloat(formData.collateralAmount)).toFixed(2)} XRP</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Loan Term (Days)</label>
              <select
                name="term"
                value={formData.term}
                onChange={handleChange}
                required
              >
                <option value="30">30 days</option>
                <option value="45">45 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            
            {/* Simplified loan terms preview */}
            {formData.amount && formData.collateralAmount && riskProfile && (
              <div className="loan-terms-preview">
                <h3>Loan Terms Preview</h3>
                <div className="preview-table">
                  <div className="preview-row">
                    <span className="preview-label">Principal:</span>
                    <span className="preview-value">{parseFloat(formData.amount).toFixed(2)} XRP</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Collateral:</span>
                    <span className="preview-value">{parseFloat(formData.collateralAmount).toFixed(2)} XRP</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Interest Rate:</span>
                    <span className="preview-value">{(riskProfile.interestRate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Interest Amount:</span>
                    <span className="preview-value">{(parseFloat(formData.amount) * riskProfile.interestRate).toFixed(2)} XRP</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-label">Term:</span>
                    <span className="preview-value">{formData.term} days</span>
                  </div>
                  <div className="preview-row highlight">
                    <span className="preview-label">Total Repayment:</span>
                    <span className="preview-value">
                      {(parseFloat(formData.amount) * (1 + riskProfile.interestRate)).toFixed(2)} XRP
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
            
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading || !formData.amount || !formData.collateralAmount || (riskProfile?.eligibleForUndercollateralized === false)}
            >
              {loading ? 'Processing...' : 'Submit Loan Application'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default LoanApplication;