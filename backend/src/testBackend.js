const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testBackend() {
  console.log('Testing XRPL Lending Backend...');
  
  try {
    // Test metrics endpoint
    console.log('\n1. Testing metrics endpoint...');
    const metricsResponse = await axios.get(`${API_URL}/metrics/dashboard`);
    console.log('Metrics endpoint working!');
    console.log('Sample data:', metricsResponse.data);
    
    // Test wallet connection
    console.log('\n2. Testing wallet connection endpoint...');
    const connectResponse = await axios.post(`${API_URL}/auth/connect`);
    console.log('Wallet connection endpoint working!');
    console.log('Payload ID:', connectResponse.data.payloadId);
    console.log('QR URL:', connectResponse.data.qrUrl);
    
    console.log('\nAll basic tests passed! Backend appears to be working.');
    console.log('\nNote: Full authentication flow requires manual XUMM approval.');
    
  } catch (error) {
    console.error('Error testing backend:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testBackend();