// Utility to test API connection
export async function testApiConnection() {
  // Always use proxy in development to avoid CORS
  const hostname = window.location.hostname;
  let API_BASE_URL;
  
  if (import.meta.env.VITE_API_URL) {
    API_BASE_URL = import.meta.env.VITE_API_URL.trim();
    if (!API_BASE_URL.endsWith('/api')) {
      API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`;
    }
  } else if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    // Use proxy on localhost to avoid CORS
    API_BASE_URL = '/api';
  } else {
    API_BASE_URL = `${window.location.protocol}//${hostname}:5000/api`;
  }

  try {
    console.log('🧪 Testing API connection to:', API_BASE_URL);
    // Build health check URL - if API_BASE_URL is '/api', endpoint should be '/api/health'
    // If API_BASE_URL is full URL, endpoint should be '/health'
    const healthUrl = API_BASE_URL.startsWith('/') 
      ? `${API_BASE_URL}/health`  // /api + /health = /api/health
      : `${API_BASE_URL}/health`; // http://localhost:5000/api + /health = http://localhost:5000/api/health
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      mode: API_BASE_URL.startsWith('/') ? 'same-origin' : 'cors', // Use same-origin for proxy
      cache: 'no-cache',
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API connection successful!', data);
      return { success: true, url: API_BASE_URL };
    } else {
      console.error('❌ API responded with error:', response.status);
      return { success: false, url: API_BASE_URL, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error('❌ API connection failed:', error.message);
    console.error('🔍 Make sure:');
    console.error('1. Backend is running: cd backend && npm start');
    console.error('2. Backend is accessible at:', API_BASE_URL);
    console.error('3. Port 5000 is not blocked by firewall');
    return { success: false, url: API_BASE_URL, error: error.message };
  }
}
