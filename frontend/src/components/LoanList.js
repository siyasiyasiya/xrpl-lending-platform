import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { loans } from '../utils/api';
import { Link } from 'react-router-dom';
import '../styles/components/LoanList.css';

const LoanList = () => {
  const { currentUser } = useAuth();
  const [myLoans, setMyLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timestamp] = useState("2025-08-12 20:43:58");
  
  // Define fetchLoans outside useEffect so it can be called from handleRetry
  const fetchLoans = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const data = await loans.getMyLoans();
      setMyLoans(data);
    } catch (error) {
      console.error('Error fetching loans:', error);
      setError('Failed to load your loans');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchLoans();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
  
  if (!currentUser) return null;
  
  // Helper function to format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  // Helper function to get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVE': return 'status-active';
      case 'PENDING': return 'status-pending';
      case 'REPAID': return 'status-repaid';
      case 'DEFAULTED': return 'status-defaulted';
      default: return '';
    }
  };
  
  // Handle retry button click
  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchLoans();
  };
  
  return (
    <div className="loan-list-card">
      <h2>Your Loans</h2>
      
      {loading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading your loans...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <div className="error-icon">!</div>
          <p>{error}</p>
          <button onClick={handleRetry} className="retry-button">
            Retry
          </button>
        </div>
      ) : myLoans.length === 0 ? (
        <div className="no-loans">
          <div className="empty-state-icon">📝</div>
          <h3>No Active Loans</h3>
          <p>You don't have any loans yet.</p>
          <p>Apply for an undercollateralized loan to get started!</p>
        </div>
      ) : (
        <div className="loan-container">
          <table className="loan-table">
            <thead>
              <tr>
                <th className="id-column">ID</th>
                <th>Amount</th>
                <th>Collateral</th>
                <th>Interest Rate</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myLoans.map(loan => (
                <tr key={loan._id}>
                  <td className="loan-id" title={loan._id}>
                    <div className="id-container">
                      <span className="full-id">{loan._id}</span>
                    </div>
                  </td>
                  <td>{loan.amount} XRP</td>
                  <td>{loan.collateralAmount} XRP</td>
                  <td>{(loan.interestRate * 100).toFixed(2)}%</td>
                  <td>{formatDate(loan.dueDate)}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(loan.status)}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td>
                    <Link to={`/loans/${loan._id}`} className="view-details-btn">
                      View Details
                    </Link>
                    {loan.status === 'ACTIVE' && (
                      <Link to={`/loans/${loan._id}/repay`} className="repay-btn">
                        Repay Loan
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="footer-info">
        <div className="user-info">Current User's Login: siyasiyasiya</div>
        <div className="last-updated">Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): {timestamp}</div>
      </div>
    </div>
  );
};

export default LoanList;