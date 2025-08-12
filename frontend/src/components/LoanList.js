import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { loans } from '../utils/api';
import { Link } from 'react-router-dom';

const LoanList = () => {
  const { currentUser } = useAuth();
  const [myLoans, setMyLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
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
    
    fetchLoans();
  }, [currentUser]);
  
  if (!currentUser) return null;
  if (loading) return <div className="loading">Loading your loans...</div>;
  if (error) return <div className="error-message">{error}</div>;
  
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
  
  return (
    <div className="loan-list-container">
      <h2>Your Loans</h2>
      
      {myLoans.length === 0 ? (
        <div className="no-loans">
          <p>You don't have any loans yet.</p>
        </div>
      ) : (
        <div className="loans-table-container">
          <table className="loans-table">
            <thead>
              <tr>
                <th>ID</th>
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
                  <td>{loan._id.substring(0, 8)}...</td>
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
                    <Link to={`/loans/${loan._id}`} className="view-button">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoanList;