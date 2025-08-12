import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import CreditScore from './CreditScore';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get user info
        const userResponse = await api.get('/user');
        setUserInfo(userResponse.data);
        
        // Get platform metrics
        const metricsResponse = await api.get('/metrics');
        setMetrics(metricsResponse.data);
        
        // Get user's loans
        const loansResponse = await api.get('/loans/my-loans');
        setLoans(loansResponse.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-welcome">Welcome back, {userInfo?.walletAddress?.substring(0, 8)}...</p>
        </div>
        <Link to="/apply" className="btn btn-primary">Apply for Loan</Link>
      </div>
      
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <h2>Your Credit Profile</h2>
            <div className="d-flex justify-content-center">
              <CreditScore score={userInfo?.creditScore || 0} />
            </div>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="card">
            <h2>Undercollateralized Lending Power</h2>
            
            {userInfo?.creditScore < 600 ? (
              <div className="alert alert-warning">
                Your credit score doesn't qualify for undercollateralized loans yet.
                Build your XRPL transaction history to improve your score.
              </div>
            ) : (
              <div className="lending-power-stats">
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-title">Maximum Loan Amount</div>
                    <div className="stat-value">
                      {userInfo?.creditScore > 750 ? '1000' : 
                       userInfo?.creditScore > 700 ? '750' : 
                       userInfo?.creditScore > 650 ? '500' : 
                       userInfo?.creditScore > 600 ? '300' : '0'} XRP
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-title">Collateral Required</div>
                    <div className="stat-value">
                      {userInfo?.creditScore > 750 ? '60%' : 
                       userInfo?.creditScore > 700 ? '70%' : 
                       userInfo?.creditScore > 650 ? '80%' : 
                       userInfo?.creditScore > 600 ? '90%' : '150%'}
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-title">Interest Rate</div>
                    <div className="stat-value">
                      {userInfo?.creditScore > 750 ? '12%' : 
                       userInfo?.creditScore > 700 ? '18%' : 
                       userInfo?.creditScore > 650 ? '25%' : 
                       userInfo?.creditScore > 600 ? '35%' : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-title">Risk Category</div>
                    <div className="stat-value">
                      {userInfo?.creditScore > 750 ? 'Very Low Risk' : 
                       userInfo?.creditScore > 700 ? 'Low Risk' : 
                       userInfo?.creditScore > 650 ? 'Medium Risk' : 
                       userInfo?.creditScore > 600 ? 'High Risk' : 'Very High Risk'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="row">
        <div className="col-12">
          <div className="card">
            <h2>Your Loans</h2>
            
            {loans.length === 0 ? (
              <div className="empty-state">
                <p>You don't have any loans yet.</p>
                <Link to="/apply" className="btn btn-primary">Apply for Your First Loan</Link>
              </div>
            ) : (
              <div className="loan-list">
                {loans.map(loan => (
                  <div key={loan._id} className="loan-card">
                    <div className="loan-amount">{loan.amount} XRP</div>
                    <div className={`loan-status loan-status-${loan.status.toLowerCase()}`}>
                      {loan.status}
                    </div>
                    
                    <div className="loan-detail">
                      <span className="loan-detail-label">Collateral:</span>
                      <span className="loan-detail-value">{loan.collateralAmount} XRP</span>
                    </div>
                    
                    <div className="loan-detail">
                      <span className="loan-detail-label">Collateral Ratio:</span>
                      <span className="loan-detail-value">
                        {((loan.collateralAmount / loan.amount) * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="loan-detail">
                      <span className="loan-detail-label">Undercollateralized:</span>
                      <span className="loan-detail-value">
                        {(loan.amount - loan.collateralAmount).toFixed(2)} XRP
                      </span>
                    </div>
                    
                    <div className="loan-detail">
                      <span className="loan-detail-label">Interest Rate:</span>
                      <span className="loan-detail-value">{(loan.interestRate * 100).toFixed(0)}%</span>
                    </div>
                    
                    <div className="loan-detail">
                      <span className="loan-detail-label">Term:</span>
                      <span className="loan-detail-value">{loan.term} days</span>
                    </div>
                    
                    {loan.dueDate && (
                      <div className="loan-detail">
                        <span className="loan-detail-label">Due Date:</span>
                        <span className="loan-detail-value">
                          {new Date(loan.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="loan-actions mt-3">
                      <Link to={`/loans/${loan._id}`} className="btn btn-outline btn-sm">
                        View Details
                      </Link>
                      
                      {loan.status === 'ACTIVE' && (
                        <Link to={`/repay/${loan._id}`} className="btn btn-primary btn-sm ml-2">
                          Repay Loan
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {metrics && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <h2>Platform Metrics</h2>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-title">Total Loans</div>
                  <div className="stat-value">{metrics.totalLoans}</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-title">Active Loans</div>
                  <div className="stat-value">{metrics.activeLoans}</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-title">Total Volume</div>
                  <div className="stat-value">{metrics.totalLoanVolume} XRP</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-title">Default Rate</div>
                  <div className="stat-value">{(metrics.defaultRate * 100).toFixed(2)}%</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-title">Undercollateralized Amount</div>
                  <div className="stat-value">{metrics.totalUndercollateralizedAmount || 0} XRP</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-title">Avg Collateral Ratio</div>
                  <div className="stat-value">{((metrics.avgCollateralRatio || 0) * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;