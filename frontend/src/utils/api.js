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
  applyForLoan: async (amount, collateralAmount, term) => {
    const response = await api.post('/loans/apply', { amount, collateralAmount, term });
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

export default api;