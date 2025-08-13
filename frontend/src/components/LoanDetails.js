import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import '../styles/components/LoanDetails.css';

const LoanDetails = () => {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/loans/${id}`);
        setLoan(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching loan details:', err);
        setError('Failed to load loan details. Please try again.');
        setLoading(false);
      }
    };

    fetchLoanDetails();
  }, [id]);

  if (loading) return <div className="loading">Loading loan details...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!loan) return <div className="not-found">Loan not found</div>;

  // Calculate collateral ratio
  const collateralRatio = (loan.collateralAmount / loan.amount) * 100;
  
  // Calculate total repaid based on repayments array
  const totalRepaid = loan.repayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  
  // Calculate interest amount
  const interestAmount = loan.amount * (loan.interestRate / 100);
  
  // Calculate total owed with interest
  const totalOwed = loan.amount + interestAmount;
  
  // Calculate remaining balance
  const remainingBalance = Math.max(0, totalOwed - totalRepaid);

  // Format date string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Calculate time remaining until due date
  const getTimeRemaining = () => {
    if (!loan.dueDate) return 'Not set';
    
    const now = new Date();
    const dueDate = new Date(loan.dueDate);
    
    if (now > dueDate) return 'Overdue';
    
    const diffTime = Math.abs(dueDate - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  return (
    <div className="loan-details-container">
      <div className="card">
        <div className="loan-details-header">
          <h1>Loan Details</h1>
          <div className={`loan-status loan-status-${loan.status.toLowerCase()}`}>
            {loan.status}
          </div>
        </div>

        <div className="loan-details-section">
          <h2>Loan Information</h2>
          
          <div className="loan-info-grid">
            <div className="loan-info-item">
              <div className="loan-info-label">Loan Amount</div>
              <div className="loan-info-value">{loan.amount} XRP</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Collateral</div>
              <div className="loan-info-value">{loan.collateralAmount} XRP</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Collateral Ratio</div>
              <div className="loan-info-value">{collateralRatio.toFixed(0)}%</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Interest Rate</div>
              <div className="loan-info-value">{loan.interestRate}%</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Term</div>
              <div className="loan-info-value">{loan.term} days</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Created Date</div>
              <div className="loan-info-value">{formatDate(loan.createdAt)}</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Due Date</div>
              <div className="loan-info-value">{formatDate(loan.dueDate)}</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Time Remaining</div>
              <div className="loan-info-value">{getTimeRemaining()}</div>
            </div>
            
            <div className="loan-info-item">
              <div className="loan-info-label">Borrower</div>
              <div className="loan-info-value address">{loan.borrower}</div>
            </div>
          </div>
        </div>

        {loan.status === 'ACTIVE' && (
          <div className="loan-details-section">
            <h2>Repayment Status</h2>
            
            <div className="repayment-progress">
              <div className="progress-label">
                <span>Repayment Progress</span>
                <span>{((totalRepaid / totalOwed) * 100).toFixed(0)}%</span>
              </div>
              <div className="progress">
                <div 
                  className="progress-bar progress-primary" 
                  style={{ width: `${Math.min((totalRepaid / totalOwed) * 100, 100)}%` }}
                ></div>
              </div>
              
              <div className="repayment-amounts">
                <div>
                  <span className="repayment-label">Total Owed:</span>
                  <span className="repayment-value">{totalOwed.toFixed(2)} XRP</span>
                </div>
                <div>
                  <span className="repayment-label">Repaid:</span>
                  <span className="repayment-value">{totalRepaid.toFixed(2)} XRP</span>
                </div>
                <div>
                  <span className="repayment-label">Remaining:</span>
                  <span className="repayment-value">{remainingBalance.toFixed(2)} XRP</span>
                </div>
              </div>
            </div>
            
            <div className="repayment-action mt-4">
              <Link to={`/repay/${loan._id}`} className="btn btn-primary">
                Make Payment
              </Link>
            </div>
          </div>
        )}

        {loan.repayments && loan.repayments.length > 0 && (
          <div className="loan-details-section">
            <h2>Payment History</h2>
            
            <div className="payment-history">
              <table className="w-100">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.repayments.map((payment, index) => (
                    <tr key={index}>
                      <td>{formatDate(payment.timestamp)}</td>
                      <td>{payment.amount} XRP</td>
                      <td>
                        <a 
                          href={`https://testnet.xrpl.org/transactions/${payment.txHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="transaction-link"
                        >
                          {payment.txHash.substring(0, 8)}...
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transaction Links for Escrow */}
        <div className="loan-details-section">
          <h2>Loan Transactions</h2>
          
          <div className="transaction-links">
            {loan.collateralTxHash && (
              <div className="transaction-item">
                <div className="transaction-label">Collateral Transaction:</div>
                <a 
                  href={`https://testnet.xrpl.org/transactions/${loan.collateralTxHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="transaction-link"
                >
                  {loan.collateralTxHash}
                </a>
              </div>
            )}
            
            {loan.escrowSequence && (
              <div className="transaction-item">
                <div className="transaction-label">Escrow Sequence:</div>
                <span className="transaction-value">{loan.escrowSequence}</span>
              </div>
            )}
            
            {loan.escrowPayloadId && (
              <div className="transaction-item">
                <div className="transaction-label">Escrow Payload ID:</div>
                <span className="transaction-value">{loan.escrowPayloadId}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Link to="/dashboard" className="btn btn-outline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoanDetails;