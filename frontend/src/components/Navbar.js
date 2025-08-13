import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import '../styles/components/Navbar.css';

const Navbar = () => {
  const { isAuthenticated, logout, currentUser } = useAuth();
  
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          XRPLend++
        </Link>
        
        <div className="navbar-links">
          <Link to="/how-it-works" className="navbar-link">How It Works</Link>
          
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="navbar-link">Dashboard</Link>
              {/* <Link to="/profile" className="navbar-link">Profile</Link> */}
              <button onClick={logout} className="navbar-button">Disconnect</button>
              
              <div className="navbar-wallet">
                <span className="wallet-address">
                  {currentUser?.walletAddress?.slice(0, 6)}...{currentUser?.walletAddress?.slice(-4)}
                </span>
              </div>
            </>
          ) : (
            <Link to="/" className="navbar-button">Connect Wallet</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;