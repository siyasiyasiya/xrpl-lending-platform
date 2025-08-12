import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import '../styles/components/LoanApplication.css'


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
  const [creditScore, setCreditScore] = useState(null);
  const [riskProfile, setRiskProfile] = useState(null);
  const [collateralRatio, setCollateralRatio] = useState(0);

  // Fetch user credit score on component mount
  useEffect(() => {
    const fetchCreditScore = async () => {
      try {
        const response = await api.get('/user/credit-score');
        setCreditScore(response.data.creditScore);
        
        // Estimate risk profile based on credit score
        if (response.data.creditScore > 750) {
          setRiskProfile({
            category: 'Very Low Risk',
            collateralRatio: 0.6,
            maxLoanAmount: 1000,
            interestRate: 0.12
          });
        } else if (response.data.creditScore > 700) {
          setRiskProfile({
            category: 'Low Risk',
            collateralRatio: 0.7,
            maxLoanAmount: 750,
            interestRate: 0.18
          });
        } else if (response.data.creditScore > 650) {
          setRiskProfile({
            category: 'Medium Risk',
            collateralRatio: 0.8,
            maxLoanAmount: 500,
            interestRate: 0.25
          });
        } else if (response.data.creditScore > 600) {
          setRiskProfile({
            category: 'High Risk',
            collateralRatio: 0.9,
            maxLoanAmount: 300,
            interestRate: 0.35
          });
        } else {
          setRiskProfile({
            category: 'Very High Risk',
            collateralRatio: 1.5,
            maxLoanAmount: 0,
            interestRate: 0,
            eligibleForUndercollateralized: false
          });
        }
      } catch (error) {
        console.error('Error fetching credit score:', error);
      }
    };
    
    fetchCreditScore();
  }, []);

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
      
      // Submit loan application
      const response = await api.post('/loans/apply', formData);
      
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
      
      // Show success message or redirect
      // For this example, we'll stay on the same page
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loan-application card">
      <h2 className="card-title">Apply for Undercollateralized Loan</h2>
      
      {riskProfile && riskProfile.eligibleForUndercollateralized === false ? (
        <div className="alert alert-danger">
          <h3>Not Eligible for Undercollateralized Lending</h3>
          <p>Your current risk profile does not qualify for undercollateralized loans.</p>
          <p>To improve your eligibility, consider building your XRP Ledger transaction history and maintaining a positive repayment record.</p>
        </div>
      ) : (
        <>
          {creditScore && riskProfile && (
            <div className="loan-eligibility-info">
              <div className="loan-eligibility-header">
                <h3>Your Lending Profile</h3>
                <div className={`badge badge-${riskProfile.category === 'Very Low Risk' || riskProfile.category === 'Low Risk' ? 'primary' : riskProfile.category === 'Medium Risk' ? 'warning' : 'danger'}`}>
                  {riskProfile.category}
                </div>
              </div>
              
              <div className="loan-terms-container">
                <div className="loan-term-row">
                  <span className="loan-term-label">Credit Score:</span>
                  <span className="loan-term-value">{creditScore}</span>
                </div>
                <div className="loan-term-row">
                  <span className="loan-term-label">Max Loan Amount:</span>
                  <span className="loan-term-value">{riskProfile.maxLoanAmount} XRP</span>
                </div>
                <div className="loan-term-row">
                  <span className="loan-term-label">Required Collateral Ratio:</span>
                  <span className="loan-term-value">{(riskProfile.collateralRatio * 100).toFixed(0)}%</span>
                </div>
                <div className="loan-term-row">
                  <span className="loan-term-label">Interest Rate:</span>
                  <span className="loan-term-value">{(riskProfile.interestRate * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Loan Amount (XRP)</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="form-control"
                placeholder="Enter loan amount"
                min="1"
                max={riskProfile?.maxLoanAmount || 1000}
                required
              />
              <div className="form-help">
                Maximum: {riskProfile?.maxLoanAmount || '1000'} XRP based on your risk profile
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Collateral Amount (XRP)</label>
              <input
                type="number"
                name="collateralAmount"
                value={formData.collateralAmount}
                onChange={handleChange}
                className="form-control"
                placeholder="Enter collateral amount"
                min={formData.amount ? (parseFloat(formData.amount) * (riskProfile?.collateralRatio || 0.6)).toFixed(2) : '1'}
                max={formData.amount ? (parseFloat(formData.amount) - 0.01).toFixed(2) : '1000'}
                required
              />
              <div className="form-help">
                For undercollateralized loans, collateral must be less than loan amount
                {formData.amount && (
                  <div>
                    <span>Min required: {(parseFloat(formData.amount) * (riskProfile?.collateralRatio || 0.6)).toFixed(2)} XRP</span>
                    <span> | Max allowed: {(parseFloat(formData.amount) - 0.01).toFixed(2)} XRP</span>
                  </div>
                )}
              </div>
              
              {/* Collateral ratio display */}
              {collateralRatio > 0 && (
                <div className="collateral-info">
                  <div>Current Collateral Ratio: {(collateralRatio * 100).toFixed(0)}%</div>
                  <div>Undercollateralized Amount: {(parseFloat(formData.amount) - parseFloat(formData.collateralAmount)).toFixed(2)} XRP</div>
                  
                  <div className="ratio-indicator">
                    <span>0%</span>
                    <div className="ratio-bar">
                      <div 
                        className="ratio-marker" 
                        style={{ 
                          position: 'relative',
                          left: `${Math.min(collateralRatio * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label className="form-label">Loan Term (Days)</label>
              <select
                name="term"
                value={formData.term}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="30">30 days</option>
                <option value="45">45 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            
            {/* Loan terms preview */}
            {formData.amount && formData.collateralAmount && riskProfile && (
              <div className="loan-terms-preview">
                <h3 className="preview-title">Loan Terms Preview</h3>
                <div className="preview-grid">
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
                  <div className="preview-row highlight">
                    <span className="preview-label">Undercollateralized Amount:</span>
                    <span className="preview-value">
                      {(parseFloat(formData.amount) - parseFloat(formData.collateralAmount)).toFixed(2)} XRP
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {error && <div className="alert alert-danger mt-3">{error}</div>}
            
            <button 
              type="submit" 
              className="btn btn-primary btn-block"
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