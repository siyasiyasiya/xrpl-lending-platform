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
      
      <div className="dashboard-grid">
        <div className="dashboard-column">
          <CreditScore />
          <LoanApplication onLoanCreated={handleLoanCreated} />
        </div>
        
        <div className="dashboard-column">
          <LoanList key={refreshLoans} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;