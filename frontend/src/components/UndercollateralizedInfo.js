import React from 'react';
import '../styles/components/UndercollateralizedElements.css';

const UndercollateralizedInfo = () => {
  return (
    <div className="undercollateralized-info">
      <section className="info-section">
        <h2>What Makes Our Platform Unique</h2>
        <p>
          Most DeFi lending platforms require overcollateralization, meaning you need to deposit more value than you borrow.
          Our platform is different - we use your on-chain reputation and credit score to allow you to borrow more than you deposit as collateral.
        </p>
        
        <div className="comparison-table mt-4">
          <h3>Comparison with Traditional DeFi</h3>
          <table className="w-100">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Traditional DeFi</th>
                <th>Our Platform</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Collateral Requirement</td>
                <td>150% or higher</td>
                <td>60-90% (based on risk)</td>
              </tr>
              <tr>
                <td>Basis for Lending</td>
                <td>Collateral value only</td>
                <td>Collateral + Credit Score</td>
              </tr>
              <tr>
                <td>Interest Rates</td>
                <td>Lower (3-8%)</td>
                <td>Higher (12-35%)</td>
              </tr>
              <tr>
                <td>Liquidation</td>
                <td>Automatic at threshold</td>
                <td>Based on term expiration</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
      <section className="info-section">
        <h2>How We Calculate Your Credit Score</h2>
        <p>
          Your credit score is derived from your XRP Ledger transaction history, considering factors such as:
        </p>
        <ul>
          <li>Account age on XRPL</li>
          <li>Transaction frequency and consistency</li>
          <li>XRP balance stability</li>
          <li>Previous loan repayment history (if any)</li>
        </ul>
      </section>
      
      <section className="info-section">
        <h2>Risk Categories and Terms</h2>
        <div className="risk-categories">
          <div className="risk-category-grid">
            <div className="risk-category-card very-low-risk">
              <h3>Very Low Risk</h3>
              <ul>
                <li>Collateral: 60%</li>
                <li>Interest: 12%</li>
                <li>Max Term: 90 days</li>
                <li>Max Amount: 1000 XRP</li>
              </ul>
            </div>
            
            <div className="risk-category-card low-risk">
              <h3>Low Risk</h3>
              <ul>
                <li>Collateral: 70%</li>
                <li>Interest: 18%</li>
                <li>Max Term: 60 days</li>
                <li>Max Amount: 750 XRP</li>
              </ul>
            </div>
            
            <div className="risk-category-card medium-risk">
              <h3>Medium Risk</h3>
              <ul>
                <li>Collateral: 80%</li>
                <li>Interest: 25%</li>
                <li>Max Term: 45 days</li>
                <li>Max Amount: 500 XRP</li>
              </ul>
            </div>
            
            <div className="risk-category-card high-risk">
              <h3>High Risk</h3>
              <ul>
                <li>Collateral: 90%</li>
                <li>Interest: 35%</li>
                <li>Max Term: 30 days</li>
                <li>Max Amount: 300 XRP</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      
      <section className="info-section">
        <h2>How Loans Work on XRPL</h2>
        <div className="process-steps">
          <div className="process-step">
            <div className="step-number">1</div>
            <h3>Connect Your Wallet</h3>
            <p>Connect your XRP Ledger wallet through XUMM.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">2</div>
            <h3>Get Your Credit Score</h3>
            <p>Our system analyzes your wallet history to generate a credit score.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">3</div>
            <h3>Apply for Loan</h3>
            <p>Choose your loan amount and provide partial collateral based on your risk category.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">4</div>
            <h3>Receive Funds</h3>
            <p>Upon approval, receive the loan directly to your XRP wallet.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">5</div>
            <h3>Repay On Time</h3>
            <p>Make repayments before the due date to build your credit score.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UndercollateralizedInfo;