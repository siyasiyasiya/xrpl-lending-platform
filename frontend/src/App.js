import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/AuthContext';

// Components
import Navbar from './components/Navbar';
// import Footer from './components/Footer';

// Pages
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
// import UserProfilePage from './pages/UserProfilePage';
// import LoanDetailsPage from './pages/LoanDetailsPage';
import RepayLoanPage from './pages/RepayLoanPage';
import HowItWorksPage from './pages/HowItWorksPage';
// import NotFoundPage from './pages/NotFoundPage';

import './styles/main.css';


// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <UserProfilePage />
                  </ProtectedRoute>
                } 
              /> */}
              
              {/* <Route 
                path="/loans/:id" 
                element={
                  <ProtectedRoute>
                    <LoanDetailsPage />
                  </ProtectedRoute>
                } 
              /> */}
              
              <Route 
                path="/repay/:id" 
                element={
                  <ProtectedRoute>
                    <RepayLoanPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* <Route path="*" element={<NotFoundPage />} /> */}
            </Routes>
          </main>
          
          {/* <Footer /> */}
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;