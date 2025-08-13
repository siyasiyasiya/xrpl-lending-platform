import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import '../styles/components/LoanApplication.css';
import { Xumm } from 'xumm';

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
  const [timestamp, setTimestamp] = useState("2025-08-12 21:50:31");
  const [isWaitingForData, setIsWaitingForData] = useState(true);
  
  // DeFi transaction signing states
  const [xummPayload, setXummPayload] = useState(null);
  const [signingStep, setSigningStep] = useState(null); // null, 'ready', 'signing'
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [loanData, setLoanData] = useState(null);

  

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
      };

      console.log('Submitting loan application:', loanApplicationData);
      
      // Submit loan application
      const response = await api.post('/loans/apply', loanApplicationData);
      setLoanData(response.data.data.loan); 
      setXummPayload(response.data.data.escrowPayload);

      console.log('Loan application response:', response);
      setSigningStep('ready')      
      
    } catch (error) {
      console.error('Error applying for loan:', error);
      setError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLoan = async () => {
    if (!loanData) return;
  
    setSigningStep('signing');
    setTransactionStatus('Starting backend subscription...');
  
    try {
      // Tell backend to subscribe to this loan's payload
      await api.post(`/loans/${loanData._id}/subscribe`);
      console.log("Backend subscription created");
      
      // Display QR code and signing UI
      setTransactionStatus('Waiting for your signature...');
      
      // If you need to get the payload details for the QR code
      if (!xummPayload) {
        const loanDetails = await api.get(`/loans/${loanData._id}`);
        if (loanDetails.data.escrowPayload) {
          setXummPayload(loanDetails.data.escrowPayload);
        }
      }
      
      // Start polling for loan status changes
      const interval = setInterval(async () => {
        try {
          const updatedLoan = await api.get(`/loans/${loanData._id}`);
          console.log("Polling loan status:", updatedLoan.data.status);
          
          if (updatedLoan.data.status === 'ACTIVE') {
            clearInterval(interval);
            setTransactionStatus('Loan successfully activated!');
            handleCompleteSigningProcess();
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
      
      // Cleanup interval after 5 minutes
      setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
      
    } catch (error) {
      console.error('Error starting activation:', error);
      setError(error.response?.data?.message || 'Failed to start activation process.');
      setSigningStep('ready');
    }
  };
  
  // Add a manual verification button for your hackathon
  const handleManualVerification = async () => {
    try {
      setTransactionStatus('Manually verifying signature...');
      
      const response = await api.post(`/loans/${loanData._id}/verify`);
      
      if (response.data.success) {
        setTransactionStatus('Loan successfully activated!');
        handleCompleteSigningProcess();
      } else {
        setError(response.data.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Manual verification error:', error);
      setError(error.response?.data?.message || 'Failed to verify signature.');
    }
  };

  // Open XUMM app for signing
  const handleOpenXummApp = () => {
    if (xummPayload?.next?.always) {
      setSigningStep('signing');
      setTransactionStatus('Opening XUMM app...');
      window.location.href = xummPayload.next.always;
    }
  };

  // Handle signing with QR code
  const handleScanQrCode = () => {
    setSigningStep('signing');
    setTransactionStatus('Please scan the QR code with XUMM app');
  };

  // Complete signing process
  const handleCompleteSigningProcess = () => {
    setSigningStep(null);
    setXummPayload(null);
    
    // Notify parent component of loan creation
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
    alert('Transaction signed! Your loan will be activated once the blockchain confirms your collateral transaction.');
  };

  // Show loading state while waiting for risk data
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

  // Show XUMM signing interface when a payload is available
  if (signingStep) { // Covers 'ready', 'signing', etc.
    return (
      <div className="loan-application-card">
        {signingStep === 'ready' && (
            <div className="activation-card">
                <h2>Application Submitted!</h2>
                <p>Your loan application has been approved based on your risk profile. The final step is to sign the on-chain transaction to lock your collateral.</p>
                <div className="loan-summary">
                    <span>Loan Amount: <strong>{loanData.amount} XRP</strong></span>
                    <span>Collateral: <strong>{loanData.collateralAmount} XRP</strong></span>
                </div>
                <button onClick={handleActivateLoan} className="submit-button">
                    Proceed to Sign
                </button>
            </div>
        )}
        
        {signingStep === 'signing' && xummPayload && (
            <div className="xumm-signing-card">
              {/* Your existing, excellent Xumm QR code UI goes here */}
              <h2>Sign Collateral Transaction</h2>
              <div className="xumm-status">
                <div className="status-badge">{transactionStatus}</div>
              </div>
              <div className="qr-code-wrapper">
                  <img src={xummPayload.refs.qr_png} alt="XUMM QR Code" />
              </div>
              <div className="signing-actions">
                  <button onClick={handleOpenXummApp}>Open in XUMM App</button>
              </div>
            </div>
        )}
      </div>
    );
  }

  // Normal loan application form
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
              
              {/* Collateral ratio display */}
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
            
            {/* Loan terms preview */}
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

          <div className="defi-notice">
            <div className="defi-icon">🔄</div>
            <div className="defi-text">
              <strong>DeFi Protocol:</strong> This is a fully automated lending protocol. After submitting, you'll sign a transaction to lock your collateral, and your loan will be automatically disbursed upon confirmation.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LoanApplication;