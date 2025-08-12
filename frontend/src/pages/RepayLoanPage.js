import React from 'react';
import RepayLoan from '../components/RepayLoan';
import '../styles/layout/RepayLoan.css';

const RepayLoanPage = () => {
  return (
    <div className="repay-loan-page">
      <div className="page-header">
        <h1>Repay Your Loan</h1>
        <p>Make a payment towards your active loan</p>
      </div>
      
      <RepayLoan />
    </div>
  );
};

export default RepayLoanPage;