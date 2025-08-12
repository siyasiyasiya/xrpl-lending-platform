import React from 'react';
import { Link } from 'react-router-dom';
import UndercollateralizedInfo from '../components/UndercollateralizedInfo';
import '../styles/layout/HowItWorks.css';

const HowItWorksPage = () => {
  return (
    <div className="how-it-works-page">
      <div className="page-header">
        <h1>How Undercollateralized Lending Works</h1>
        <p>A revolutionary approach to DeFi lending on the XRP Ledger</p>
      </div>
      
      <UndercollateralizedInfo />
      
      <div className="cta-container">
        <h2>Ready to get started?</h2>
        <Link to="/" className="btn">Connect Your Wallet</Link>
      </div>
    </div>
  );
};

export default HowItWorksPage;