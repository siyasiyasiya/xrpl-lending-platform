import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import '../styles/components/RepayLoan.css';

const RepayLoan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Loan data states
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Repayment states
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // XUMM transaction states
  const [xummPayload, setXummPayload] = useState(null);
  const [signingStep, setSigningStep] = useState(null); // null, 'ready', 'signing'
  const [transactionStatus, setTransactionStatus] = useState('');
  const [success, setSuccess] = useState('');
  const [repaymentData, setRepaymentData] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/loans/${id}`);
        setLoan(response.data);
        
        // Calculate remaining balance
        const interestAmount = response.data.amount * (response.data.interestRate / 100);
        const totalOwed = response.data.amount + interestAmount;
        const totalRepaid = response.data.repayments?.reduce(
          (sum, payment) => sum + payment.amount, 0
        ) || 0;
        const remaining = Math.max(0, totalOwed - totalRepaid);
        
        // Set default repayment amount to remaining balance
        setAmount(remaining.toFixed(6));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching loan details:', err);
        setError('Failed to load loan details. Please try again.');
        setLoading(false);
      }
    };

    fetchLoanDetails();
    
    // Clear any polling intervals when component unmounts
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      // Validate amount
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid repayment amount');
      }

      console.log('Submitting repayment request:', { amount: parseFloat(amount) });
      
      // Request payment
      const response = await api.post(`/loans/${id}/repay`, { 
        amount: parseFloat(amount) 
      });
      
      console.log('Repayment response:', response.data);
      
      // Store repayment data
      setRepaymentData(response.data.repayment);
      
      // Set XUMM payload for signing
      if (response.data.payload) {
        setXummPayload(response.data.payload);
        setSigningStep('ready');
      } else {
        throw new Error('No payment payload received');
      }
      
    } catch (err) {
      console.error('Error submitting repayment:', err);
      setError(err.response?.data?.message || err.message || 'Failed to process repayment');
      setSubmitting(false);
    }
  };
  
  const handleInitiateRepayment = async () => {
    if (!repaymentData) return;
  
    setSigningStep('signing');
    setTransactionStatus('Starting backend subscription...');
  
    try {
      // Tell backend to subscribe to this repayment's payload
      await api.post(`/loans/${id}/repayments/${repaymentData._id}/subscribe`);
      console.log("Backend subscription created");
      
      // Display QR code and signing UI
      setTransactionStatus('Waiting for your signature...');
      
      // Start polling for repayment status changes
      const interval = setInterval(async () => {
        try {
          const updatedLoan = await api.get(`/loans/${id}`);
          console.log("Polling loan status for repayments");
          
          // Find the current repayment
          const currentRepayment = updatedLoan.data.repayments?.find(
            r => r._id === repaymentData._id
          );
          
          if (currentRepayment && currentRepayment.confirmed) {
            clearInterval(interval);
            setTransactionStatus('Repayment successfully confirmed!');
            handleCompleteSigningProcess();
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
      
      // Store interval ID for cleanup
      setPollingInterval(interval);
      
      // Cleanup interval after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        setPollingInterval(null);
      }, 5 * 60 * 1000);
      
    } catch (error) {
      console.error('Error starting repayment process:', error);
      setError(error.response?.data?.message || 'Failed to start repayment process.');
      setSigningStep('ready');
    }
  };

  // For demo/hackathon manual verification
  const handleManualVerification = async () => {
    try {
      setTransactionStatus('Manually verifying signature...');
      
      const response = await api.post(`/loans/${id}/repayments/${repaymentData._id}/verify`);
      
      if (response.data.success) {
        setTransactionStatus('Repayment successfully confirmed!');
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
      window.location.href = xummPayload.next.always;
    }
  };

  // Complete signing process
  const handleCompleteSigningProcess = () => {
    // Clear states
    setSigningStep(null);
    setXummPayload(null);
    setSubmitting(false);
    
    // Show success message and redirect
    setSuccess('Transaction signed! Your repayment has been processed.');
    
    setTimeout(() => {
      navigate(`/loans/${id}`);
    }, 2000);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="repay-loan-container">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading loan details...</p>
        </div>
      </div>
    );
  }
  
  if (error && !loan) {
    return (
      <div className="repay-loan-container">
        <div className="error-message">
          <div className="error-icon">!</div>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="retry-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  if (!loan) {
    return (
      <div className="repay-loan-container">
        <div className="no-loans">
          <div className="empty-state-icon">🔍</div>
          <h3>Loan Not Found</h3>
          <p>The requested loan could not be found.</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary mt-4">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Calculate loan metrics
  const interestAmount = loan.amount * (loan.interestRate / 100);
  const totalOwed = loan.amount + interestAmount;
  const totalRepaid = loan.repayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  const remainingBalance = Math.max(0, totalOwed - totalRepaid);

  // Show XUMM signing interface when a payload is available
  if (signingStep) {
    return (
      <div className="repay-loan-container">
        <div className="loan-list-card">
          {signingStep === 'ready' && (
            <div className="activation-card">
              <h2>Repayment Ready!</h2>
              <p>Your repayment request has been prepared. The next step is to sign the transaction to complete your payment.</p>
              <div className="loan-summary">
                <span>Loan ID: <strong>{loan._id}</strong></span>
                <span>Repayment Amount: <strong>{amount} XRP</strong></span>
              </div>
              <button onClick={handleInitiateRepayment} className="submit-button">
                Proceed to Sign
              </button>
            </div>
          )}
          
          {signingStep === 'signing' && xummPayload && (
            <div className="xumm-signing-card">
              <h2>Sign Repayment Transaction</h2>
              <div className="xumm-status">
                <div className="status-badge">{transactionStatus}</div>
              </div>
              <div className="qr-code-wrapper">
                <img src={xummPayload.refs.qr_png} alt="XUMM QR Code" className="payment-qr" />
              </div>
              <div className="signing-actions">
                <button onClick={handleOpenXummApp} className="xumm-button">
                  Open in XUMM App
                </button>
                {/* For hackathon demo purposes */}
                <button onClick={handleManualVerification} className="manual-verify-button">
                  Demo: Manual Verification
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="repay-loan-container">
      <div className="loan-list-card">
        <div className="repay-loan-header">
          <h2>Repay Loan</h2>
          <div className={`status-badge status-${loan.status.toLowerCase()}`}>
            {loan.status}
          </div>
        </div>
        
        <div className="loan-details-section">
          <h3>Loan Summary</h3>
          <div className="loan-summary-grid">
            <div className="loan-summary-item">
              <div className="loan-summary-label">Loan ID</div>
              <div className="loan-summary-value loan-id">{loan._id}</div>
            </div>
            
            <div className="loan-summary-item">
              <div className="loan-summary-label">Loan Amount</div>
              <div className="loan-summary-value">{loan.amount} XRP</div>
            </div>
            
            <div className="loan-summary-item">
              <div className="loan-summary-label">Interest Rate</div>
              <div className="loan-summary-value">{loan.interestRate}%</div>
            </div>
            
            <div className="loan-summary-item">
              <div className="loan-summary-label">Interest Amount</div>
              <div className="loan-summary-value">{interestAmount.toFixed(6)} XRP</div>
            </div>
            
            <div className="loan-summary-item">
              <div className="loan-summary-label">Due Date</div>
              <div className="loan-summary-value">{formatDate(loan.dueDate)}</div>
            </div>
            
            <div className="loan-summary-item">
              <div className="loan-summary-label">Term</div>
              <div className="loan-summary-value">{loan.term} days</div>
            </div>
          </div>
        </div>
        
        <div className="loan-details-section">
          <h3>Payment Information</h3>
          <div className="repayment-progress">
            <div className="progress-label">
              <span>Repayment Progress</span>
              <span>{Math.min(100, ((totalRepaid / totalOwed) * 100).toFixed(0))}%</span>
            </div>
            <div className="progress">
              <div 
                className="progress-bar progress-primary" 
                style={{ width: `${Math.min(100, (totalRepaid / totalOwed) * 100)}%` }}
              ></div>
            </div>
            
            <div className="payment-summary-grid">
              <div className="payment-summary-item">
                <div className="payment-summary-label">Total Owed</div>
                <div className="payment-summary-value">{totalOwed.toFixed(6)} XRP</div>
              </div>
              
              <div className="payment-summary-item">
                <div className="payment-summary-label">Total Repaid</div>
                <div className="payment-summary-value">{totalRepaid.toFixed(6)} XRP</div>
              </div>
              
              <div className="payment-summary-item">
                <div className="payment-summary-label">Remaining Balance</div>
                <div className="payment-summary-value">{remainingBalance.toFixed(6)} XRP</div>
              </div>
            </div>
          </div>
        </div>
        
        {remainingBalance <= 0 ? (
          <div className="fully-repaid-section">
            <div className="success-icon">✓</div>
            <h3>Loan Fully Repaid</h3>
            <p>Congratulations! This loan has been fully repaid.</p>
            <Link to={`/loans/${id}`} className="btn btn-primary mt-4">
              View Loan Details
            </Link>
          </div>
        ) : (
          <div className="repayment-section">
            <h3>Make a Payment</h3>
            <form onSubmit={handleSubmit} className="repayment-form">
              <div className="form-group">
                <label htmlFor="amount">Repayment Amount (XRP)</label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0.000001"
                  max={remainingBalance}
                  step="0.000001"
                  className="form-control"
                  required
                />
                <small className="form-text">
                  Maximum: {remainingBalance.toFixed(6)} XRP
                </small>
              </div>
              
              {error && <div className="error-alert">{error}</div>}
              {success && <div className="success-alert">{success}</div>}
              
              <div className="defi-notice">
                <div className="defi-icon">🔄</div>
                <div className="defi-text">
                  <strong>DeFi Protocol:</strong> This is a fully automated lending protocol. After submitting, you'll sign a transaction to complete your repayment, which will be automatically processed upon confirmation.
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={submitting || remainingBalance <= 0}
                >
                  {submitting ? 'Processing...' : 'Make Payment'}
                </button>
                
                <Link to={`/loans/${id}`} className="btn btn-outline">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default RepayLoan;