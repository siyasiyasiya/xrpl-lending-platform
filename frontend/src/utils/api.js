import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  connectWallet: async () => {
    const response = await api.post('/auth/connect');
    return response.data;
  },
  verifyConnection: async (payloadId) => {
    const response = await api.post('/auth/verify', { payloadId });
    return response.data;
  }
};

export const loans = {
  applyForLoan: async (loanData) => {
    const response = await api.post('/loans/apply', loanData);
    return response.data;
  },
  executeLoan: async (loanId) => {
    // This calls the backend to get the Xumm payload for signing.
    const response = await api.post(`/loans/${loanId}/execute`);
    return response.data;
  },
  getMyLoans: async () => {
    const response = await api.get('/loans/my-loans');
    return response.data;
  },
  getLoanDetails: async (loanId) => {
    const response = await api.get(`/loans/${loanId}`);
    return response.data;
  },
  makeRepayment: async (loanId, amount) => {
    const response = await api.post(`/loans/${loanId}/repay`, { amount });
    return response.data;
  }
};

export const metrics = {
  getDashboardMetrics: async () => {
    const response = await api.get('/metrics/dashboard');
    return response.data;
  }
};

export const creditScore = {
    getCreditScore: async (walletAddress) => {
      const response = await api.get('/credit/credit-score/', {
        params: { address: walletAddress }
      });
      return response.data;
    }
};

export default api;