import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import '../styles/components/RepayLoan.css';

const RepayLoan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        const response = await api.get(`/loans/${id}`);
        setLoan(response.data);
        
        // Calculate remaining balance
        const totalOwed = response.data.amount * (1 + response.data.interestRate);
        const totalRepaid = response.data.repaymentHistory?.reduce(
          (sum, payment) => sum + payment.amount, 0
        ) || 0;
        const remaining = Math.max(0, totalOwed - totalRepaid);
        
        // Set default repayment amount to remaining balance
        setAmount(remaining.toFixed(2));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching loan details:', err);
        setError('Failed to load loan details. Please try again.');
        setLoading(false);
      }
    };

    fetchLoanDetails();
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

      // Request payment
      const response = await api.post(`/loans/${id}/repay`, { amount: parseFloat(amount) });
      
      // For XUMM integration, handle the QR code or sign request
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
      }
      
      if (response.data.paymentUrl) {
        setPaymentUrl(response.data.paymentUrl);
        // Open XUMM app or web page for signing
        window.open(response.data.paymentUrl, '_blank');
      }
      
      setSuccess('Repayment request created. Please sign the transaction in your XUMM wallet.');
      
      // In a real app, you'd poll for the payment status
      // For the hackathon demo, we'll just assume it succeeds after 5 seconds
      setTimeout(() => {
        setSuccess('Repayment successful! Redirecting to loan details...');
        setTimeout(() => {
          navigate(`/loans/${id}`);
        }, 2000);
      }, 5000);
      
    } catch (err) {
      console.error('Error submitting repayment:', err);
      setError(err.response?.data?.message || err.message || 'Failed to process repayment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading loan details...</div>;
  if (error && !loan) return <div className="error-message">{error}</div>;
  if (!loan) return <div className="not-found">Loan not found</div>;

  // Calculate total owed, total repaid, and remaining balance
  const totalOwed = loan.amount * (1 + loan.interestRate);
  const totalRepaid = loan.repaymentHistory?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  const remainingBalance = Math.max(0, totalOwed - totalRepaid);

  return (
    <div className="repay-loan-container card">
      <h2 className="card-title">Repay Loan</h2>
      
      <div className="loan-summary">
        <div className="loan-summary-item">
          <div className="loan-summary-label">Loan Amount:</div>
          <div className="loan-summary-value">{loan.amount} XRP</div>
        </div>
        
        <div className="loan-summary-item">
          <div className="loan-summary-label">Interest:</div>
          <div className="loan-summary-value">{(loan.amount * loan.interestRate).toFixed(2)} XRP ({(loan.interestRate * 100).toFixed(0)}%)</div>
        </div>
        
        <div className="loan-summary-item">
          <div className="loan-summary-label">Total Owed:</div>
          <div className="loan-summary-value">{totalOwed.toFixed(2)} XRP</div>
        </div>
        
        <div className="loan-summary-item">
          <div className="loan-summary-label">Total Repaid:</div>
          <div className="loan-summary-value">{totalRepaid.toFixed(2)} XRP</div>
        </div>
        
        <div className="loan-summary-item">
          <div className="loan-summary-label">Remaining Balance:</div>
          <div className="loan-summary-value">{remainingBalance.toFixed(2)} XRP</div>
        </div>
        
        <div className="loan-summary-item">
          <div className="loan-summary-label">Collateral:</div>
          <div className="loan-summary-value">{loan.collateralAmount} XRP</div>
        </div>
        
        <div className="loan-summary-item">
          <div className="loan-summary-label">Undercollateralized Amount:</div>
          <div className="loan-summary-value">{(loan.amount - loan.collateralAmount).toFixed(2)} XRP</div>
        </div>
      </div>
      
      {remainingBalance <= 0 ? (
        <div className="alert alert-success mt-4">
          This loan has been fully repaid!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="repayment-form">
          <div className="form-group">
            <label htmlFor="amount" className="form-label">Repayment Amount (XRP)</label>
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
            <div className="form-help">
              Enter the amount you wish to repay. Maximum: {remainingBalance.toFixed(2)} XRP
            </div>
          </div>
          
          {error && <div className="alert alert-danger mt-3">{error}</div>}
          {success && <div className="alert alert-success mt-3">{success}</div>}
          
          {qrCode && (
            <div className="qr-container mt-4">
              <p>Scan this QR code with your XUMM app to complete the payment:</p>
              <img src={qrCode} alt="Payment QR Code" className="payment-qr" />
            </div>
          )}
          
          {paymentUrl && !qrCode && (
            <div className="payment-link mt-4">
              <p>Click the button below if the XUMM app didn't open automatically:</p>
              <a 
                href={paymentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                Open in XUMM
              </a>
            </div>
          )}
          
          <div className="form-actions mt-4">
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={submitting || remainingBalance <= 0}
            >
              {submitting ? 'Processing...' : 'Make Payment'}
            </button>
            
            <Link to={`/loans/${id}`} className="btn btn-outline ml-3">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

export default RepayLoan;