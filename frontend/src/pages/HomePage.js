import React from 'react';
import WalletConnect from '../components/WalletConnect';
import { useAuth } from '../utils/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import '../styles/layout/Home.css';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  
  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Undercollateralized Lending on XRPL</h1>
        <p>Borrow more than your collateral based on your on-chain credit score</p>
        
        <div className="connect-wallet-container">
          <WalletConnect />
        </div>
      </div>
      
      <section className="features-section">
        <div className="features-container">
            <h2 className="features-title">Revolutionary Lending Platform</h2>
            
            <div className="features-grid">
            {/* Undercollateralized Loans */}
            <div className="feature-card">
                <div className="feature-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1V23" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                </div>
                <h3>Undercollateralized Loans</h3>
                <p>Unlike traditional DeFi, borrow up to 40% more than your collateral</p>
            </div>
            
            {/* AI Credit Scoring */}
            <div className="feature-card">
                <div className="feature-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14.5 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V7.5L14.5 2Z" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 18C13.6569 18 15 16.6569 15 15C15 13.3431 13.6569 12 12 12C10.3431 12 9 13.3431 9 15C9 16.6569 10.3431 18 12 18Z" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 8H9" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 12H9" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M15 12H16" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                </div>
                <h3>AI Credit Scoring</h3>
                <p>Our AI analyzes your on-chain activity to generate a fair credit score</p>
            </div>
            
            {/* Risk-Based Terms */}
            <div className="feature-card">
                <div className="feature-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 16V12" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 8H12.01" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                </div>
                <h3>Risk-Based Terms</h3>
                <p>Loan terms tailored to your unique risk profile</p>
            </div>
            
            {/* Full Transparency */}
            <div className="feature-card">
                <div className="feature-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                </div>
                <h3>Full Transparency</h3>
                <p>All loan terms and conditions are clear and on-chain</p>
            </div>
            </div>
        </div>
        </section>
      
      <div className="cta-section">
        <h2>How Undercollateralized Lending Works</h2>
        <p>Traditional DeFi requires 150%+ collateral. We're different.</p>
        
        <div className="comparison-table">
            <div className="comparison-row comparison-header">
                <div className="comparison-cell">Comparison</div>
                <div className="comparison-cell">Traditional DeFi</div>
                <div className="comparison-cell highlight">Our Platform</div>
            </div>
            <div className="comparison-row">
                <div className="comparison-cell" data-label="Comparison">Collateral Required</div>
                <div className="comparison-cell" data-label="Traditional DeFi">150% of Loan</div>
                <div className="comparison-cell highlight" data-label="Our Platform">60-90% of Loan</div>
            </div>
            <div className="comparison-row">
                <div className="comparison-cell" data-label="Comparison">$1000 Loan Requires</div>
                <div className="comparison-cell" data-label="Traditional DeFi">$1500 Collateral</div>
                <div className="comparison-cell highlight" data-label="Our Platform">$600-900 Collateral</div>
            </div>
            <div className="comparison-row">
                <div className="comparison-cell" data-label="Comparison">Based On</div>
                <div className="comparison-cell" data-label="Traditional DeFi">Collateral Only</div>
                <div className="comparison-cell highlight" data-label="Our Platform">Credit Score + Collateral</div>
            </div>
        </div>
        
        <Link to="/how-it-works" className="btn btn-secondary mt-4">Learn More</Link>
      </div>
    </div>
  );
};

export default HomePage;