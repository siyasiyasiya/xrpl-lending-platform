import React from 'react';
import CreditScore from '../components/CreditScore';
import LoanApplication from '../components/LoanApplication';
import LoanList from '../components/LoanList';
import { useAuth } from '../utils/AuthContext';
import '../styles/layout/Dashboard.css';

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const [refreshLoans, setRefreshLoans] = React.useState(0);
  
  const handleLoanCreated = () => {
    // Trigger loan list refresh
    setRefreshLoans(prev => prev + 1);
  };
  
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Welcome to Your Dashboard</h1>
        <p>Wallet Address: {currentUser?.walletAddress}</p>
      </div>
      
      {/* Horizontal cards section */}
      <div className="horizontal-cards-row">
        <div className="card-container">
          <CreditScore />
        </div>
        <div className="card-container">
          <LoanApplication onLoanCreated={handleLoanCreated} />
        </div>
      </div>
      
      {/* Loan list section */}
      <div className="loan-list-section">
        <LoanList key={refreshLoans} />
      </div>
      
      <div className="dashboard-footer">
        <div className="footer-info">
          <div className="user-info">Current User's Login: siyasiyasiya</div>
          <div className="last-updated">Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): 2025-08-12 19:43:38</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;