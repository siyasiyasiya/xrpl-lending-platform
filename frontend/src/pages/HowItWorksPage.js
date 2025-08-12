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
    </div>
  );
};

export default HowItWorksPage;