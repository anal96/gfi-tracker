// Robust API URL detection with fallback testing
const testApiUrl = async (url) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${url}/health`, { 
      signal: controller.signal,
      method: 'GET',
      mode: 'cors'
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

// SIMPLIFIED: Robust API URL detection
const getApiBaseUrl = () => {
  // 1. Explicit VITE_API_URL (Production with separate backend)
  if (import.meta.env.VITE_API_URL && import.meta.env.MODE === 'production') {
    let url = import.meta.env.VITE_API_URL.trim();
    if (!url.endsWith('/api')) {
      url = url.endsWith('/') ? `${url}api` : `${url}/api`;
    }
    console.log('✅ Using VITE_API_URL:', url);
    return url;
  }
  
  // 2. Default: Always use relative path /api
  // This allows the host (Vite Dev, Vite Preview, Nginx, etc.) to handle the proxying.
  // It works perfectly for:
  // - Localhost Dev (localhost:3000 -> localhost:5000)
  // - Port Forwarding (192.168.x.x:4173 -> localhost:5000)
  // - Production (same domain)
  console.log('✅ Using relative /api path (Proxy Strategy)');
  return '/api';
};

// Get the base URL
let API_BASE_URL = getApiBaseUrl();

// CRITICAL SAFETY CHECK: Force proxy if we somehow got a direct connection URL
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && API_BASE_URL.includes(':5000')) {
    console.error('🚨 ERROR: Detected direct connection to port 5000 on localhost - FORCING proxy!');
    API_BASE_URL = '/api';
  }
}

const FINAL_API_BASE_URL = API_BASE_URL;

// Log the API URL being used
console.log('🔗 API Base URL:', FINAL_API_BASE_URL);
console.log('🌐 Current location:', window.location.href);
console.log('🔧 Dev mode:', import.meta.env.DEV);
console.log('🔧 Mode:', import.meta.env.MODE);

class ApiService {
  constructor() {
    // No token storage needed - using sessions with cookies
  }

  setToken(token) {
    // Deprecated - sessions are handled automatically by cookies
    // Keeping for backward compatibility but does nothing
  }

  getToken() {
    // Deprecated - sessions are handled automatically by cookies
    return null;
  }

  async request(endpoint, options = {}) {
    // Ensure endpoint starts with /
    const endpointPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // DEFAULT: Use relative /api path (Proxy Strategy) - safest for all environments
    let baseUrl = '/api'; 
    
    // Override only if strict VITE_API_URL is set in production
    if (import.meta.env.MODE === 'production' && import.meta.env.VITE_API_URL) {
      let url = import.meta.env.VITE_API_URL.trim();
      if (!url.endsWith('/api')) {
        url = url.endsWith('/') ? `${url}api` : `${url}/api`;
      }
      baseUrl = url;
    }

    // Build URL
    let url = `${baseUrl}${endpointPath}`;
    
    // REMOVED: All manual port 5000 checks/hacks.
    // We strictly trust the proxy (/api) to handle routing.
    
    // Determine fetch mode based on final URL
    const isProxy = baseUrl.startsWith('/') || url.startsWith('/');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      // IMPORTANT: When using proxy (/api), use 'same-origin' to avoid CORS
      // When using direct connection, use 'cors'
      // ALWAYS include credentials for session cookies
      mode: isProxy ? 'same-origin' : 'cors',
      credentials: 'include', // Include cookies for session-based auth
    };

    try {
      // Add timeout for fetch requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      config.signal = controller.signal;

      console.log('📤 API Request:', options.method || 'GET', url);
      
      // Only cache GET requests
      const useCache = (options.method === 'GET' || !options.method) && !url.includes('/auth/');
      const cacheKey = `api_cache_${url}`;
      const cacheMaxAge = options.cacheMaxAge ?? 120000; // 2 min default: return cache immediately if fresh

      // Stale-while-revalidate: return cached data immediately if fresh (WhatsApp-style instant load)
      if (useCache) {
        try {
          const cachedItem = localStorage.getItem(cacheKey);
          if (cachedItem) {
            const parsed = JSON.parse(cachedItem);
            if (parsed && parsed.data != null && (Date.now() - (parsed.timestamp || 0)) < cacheMaxAge) {
              console.log('⚡ Cache hit (fresh):', endpointPath);
              return parsed.data;
            }
          }
        } catch (e) {
          // ignore cache read errors
        }
      }

      try {
        const response = await fetch(url, {
          ...config,
          // cache: 'no-cache', // Allow browser/SW caching
        });
        clearTimeout(timeoutId);
        
        // Handle non-JSON responses
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json();
            // Cache successful GET responses
            if (response.ok && useCache) {
              try {
                let dataToCache = data;
                if (options.transformCache) {
                  try {
                    dataToCache = options.transformCache(data);
                  } catch (err) {
                    console.warn('Cache transform failed:', err);
                  }
                }

                const dataString = JSON.stringify({
                  timestamp: Date.now(),
                  data: dataToCache
                });
                
                // Check size (approximate) - 5MB limit is ~5 million chars
                if (dataString.length > 4500000) {
                   console.warn(`📦 Data too large to cache (${(dataString.length / 1024 / 1024).toFixed(2)} MB): ${url}`);
                   return data; // Return early without caching
                }

                localStorage.setItem(cacheKey, dataString);
              } catch (e) {
                // Handle QuotaExceededError
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                  console.warn('⚠️ LocalStorage quota exceeded. Attempting to make space...');
                  try {
                    // Strategy 1: Clear all OTHER API cache items
                    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('api_cache_') && k !== cacheKey);
                    if (allKeys.length > 0) {
                      console.log(`🧹 Clearing ${allKeys.length} old cache items to make space...`);
                      allKeys.forEach(k => localStorage.removeItem(k));
                      
                      // Strategy 2: Remove oldest non-API items if needed (optional, skipping for safety)

                      // Strategy 3: Try saving again
                      try {
                        localStorage.setItem(cacheKey, JSON.stringify({
                          timestamp: Date.now(),
                          data: data
                        }));
                        console.log('✅ Cache cleared and new item saved.');
                      } catch (retryErr) {
                         console.error(`❌ Item too large even after clearing (${url}). Skipping cache.`);
                      }
                    } else {
                      console.error(`❌ Cache full with meaningful data, cannot save new item (${url}). Skipping.`);
                    }
                  } catch (cleanupErr) {
                    console.error('❌ Error during cache cleanup:', cleanupErr);
                  }
                } else {
                  console.warn('Failed to cache API response:', e);
                }
              }
            }
          } catch (jsonError) {
            const text = await response.text();
            throw new Error(`Invalid JSON response: ${text}`);
          }
        } else {
          const text = await response.text();
          throw new Error(text || 'Invalid response format');
        }

        if (!response.ok) {
          if (response.status === 401) {
             throw new Error('Unauthorized - Please login again');
          }
          const errorMessage = data?.message || data?.error || (data && typeof data === 'object' ? JSON.stringify(data) : String(data)) || `Request failed with status ${response.status}`;
          console.error('API error', response.status, url, data || '(no body)');
          const err = new Error(errorMessage);
          err.status = response.status;
          throw err;
        }

        return data;
      } catch (networkError) {
        // Network failed - try manual offline cache
        if (useCache && (networkError.message.includes('Failed to fetch') || networkError.name === 'TypeError' || networkError.name === 'AbortError')) {
           console.warn('⚠️ Network request failed, checking offline cache for:', url);
           const cachedItem = localStorage.getItem(cacheKey);
           if (cachedItem) {
             try {
               const parsed = JSON.parse(cachedItem);
               console.log('✅ Serving manual cached data for:', url);
               return parsed.data;
             } catch (e) {
               console.error('Error parsing manual cache:', e);
             }
           }
        }
        throw networkError;
      }
    } catch (error) {
       // ... existing error logging ...
      if (error.name === 'AbortError') {
        console.error('API Request timeout:', url);
        throw new Error('Request timeout - backend may not be running');
      }
      
      // Log network errors...
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        // We already tried cache above, if we are here, cache missed
        console.error('❌ API Request failed and no cache available:', url);
      }
      
      throw error;
    }
  }

  // Auth endpoints - using session-based authentication (no JWT tokens!)
  async login(email, password) {
    try {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // No token handling needed - session cookie is set automatically
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    // No token handling needed - session cookie is set automatically
    return data;
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOtp(email, otp) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resetPassword(email, otp, password) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async updateProfile(name, email, avatar) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email, avatar }),
    });
  }

  async logout() {
    try {
      const data = await this.request('/auth/logout', {
        method: 'POST',
      });
      // Session cookie is cleared by backend
      
      // Clear all API cache to prevent data leak between users
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('api_cache_')) {
            localStorage.removeItem(key);
          }
        });
      }

      return data;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Teacher endpoints
  async getTeacherDashboard(batchId = null, date = null) {
    const params = new URLSearchParams();
    if (batchId && batchId !== 'all') params.append('batchId', batchId);
    if (date) params.append('date', date instanceof Date ? date.toISOString() : date);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/teacher/dashboard${queryString}`, { cacheMaxAge: 0 });
  }

  async updateTimeSlot(slotId, checked, breakDuration = null, date = null) {
    try {
      const response = await this.request('/teacher/time-slots', {
        method: 'POST',
        body: JSON.stringify({ slotId, checked, breakDuration, date }),
      });
      return response;
    } catch (error) {
      console.error(`Error updating slot ${slotId} to ${checked}:`, error);
      // Provide more specific error messages
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new Error(`Time slot '${slotId}' not found. Please refresh the page.`);
      } else if (errorMessage.includes('locked')) {
        throw new Error(`Cannot modify locked slot '${slotId}'. Please contact administrator.`);
      }
      throw error;
    }
  }

  async updateBreakTiming(breakDuration, date = null) {
    try {
      const response = await this.request('/teacher/time-slots/break', {
        method: 'POST',
        body: JSON.stringify({ breakDuration, date }),
      });
      return response;
    } catch (error) {
      console.error(`Error updating break timing:`, error);
      throw error;
    }
  }

  async startUnit(unitId) {
    return this.request(`/teacher/units/${unitId}/start`, {
      method: 'POST',
    });
  }

  async completeUnit(unitId) {
    return this.request(`/teacher/units/${unitId}/complete`, {
      method: 'POST',
    });
  }

  async getPendingApprovals() {
    return this.request('/teacher/pending-approvals');
  }

  async getNotifications() {
    return this.request('/teacher/notifications', { cacheMaxAge: 0 });
  }

  async getAdminNotifications(skipCache = false) {
    const endpoint = skipCache ? `/admin/notifications?_t=${Date.now()}` : '/admin/notifications';
    return this.request(endpoint, skipCache ? { cacheMaxAge: 0 } : {});
  }

  async getVerifierNotifications() {
    return this.request('/verifier/notifications', { cacheMaxAge: 0 });
  }

  async deleteNotification(id) {
    return this.request(`/verifier/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  async approveTeacherAssignment(assignmentId) {
    return this.request(`/teacher/assignments/${assignmentId}/approve`, {
      method: 'POST',
    });
  }

  async rejectTeacherAssignment(assignmentId, reason) {
    return this.request(`/teacher/assignments/${assignmentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getTimeSlotApprovalStatus(date = null) {
    const params = new URLSearchParams();
    if (date) params.append('date', date instanceof Date ? date.toISOString() : date);
    params.append('_t', Date.now()); // Prevent caching
    
    return this.request(`/teacher/time-slots/approval-status?${params.toString()}`, { cacheMaxAge: 0 });
  }

  async cancelApprovalRequest(approvalId) {
    return this.request(`/teacher/approvals/${approvalId}/cancel`, {
      method: 'POST',
    });
  }

  async getTeacherAssignments() {
    return this.request('/teacher/assignments', { cacheMaxAge: 0 });
  }

  // Admin endpoints
  async getAdminDashboard(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/admin/dashboard${params ? `?${params}` : ''}`, { cacheMaxAge: 0 });
  }

  async getAdminProgress(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/admin/progress${params ? `?${params}` : ''}`);
  }

  async getTeachers() {
    return this.request('/admin/teachers', { cacheMaxAge: 0 });
  }

  // User Management
  async getUsers() {
    return this.request('/admin/users', { cacheMaxAge: 0 });
  }

  async createUser(userData) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUser(userId, userData) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(userId) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  // Verifier endpoints
  async getVerifierDashboard(forceRefresh = false) {
    return this.request('/verifier/dashboard', {
      cacheMaxAge: 0,
      transformCache: (response) => {
        if (!response || !response.success || !response.data) return response;
        
        // Clone to avoid mutating original for UI
        const cachedFn = { ...response };
        cachedFn.data = { ...response.data };
        
        // 1. Strip avatars to save space
        const stripAvatars = (approvals) => {
           return approvals.map(a => ({
             ...a,
             requestedBy: a.requestedBy ? { ...a.requestedBy, avatar: undefined } : a.requestedBy
           }));
        };
        
        // 2. Keep all pending (critical), but truncate recent history
        if (cachedFn.data.recentApprovals) {
          cachedFn.data.recentApprovals = stripAvatars(cachedFn.data.recentApprovals.slice(0, 10)); // Keep only last 10
        }
        
        if (cachedFn.data.pendingApprovals) {
          cachedFn.data.pendingApprovals = stripAvatars(cachedFn.data.pendingApprovals);
        }

        return cachedFn;
      }
    });
  }

  async getVerifierApprovals(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/verifier/approvals${params ? `?${params}` : ''}`);
  }

  async approveRequest(approvalId) {
    return this.request(`/verifier/approvals/${approvalId}/approve`, {
      method: 'POST',
    });
  }

  async rejectRequest(approvalId, reason) {
    return this.request(`/verifier/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Assignment endpoints
  async getTeachersWithIncompleteSubjects(batchId = null) {
    const params = batchId ? `?batchId=${batchId}` : '';
    return this.request(`/verifier/assign/teachers-incomplete${params}`);
  }

  async getAvailableTeachers(batchId = null) {
    const params = batchId ? `?batchId=${batchId}` : '';
    return this.request(`/verifier/assign/available-teachers${params}`);
  }

  async getSubjectUnits(subjectId, teacherId = null) {
    const params = teacherId ? `?subjectId=${subjectId}&teacherId=${teacherId}` : `?subjectId=${subjectId}`;
    return this.request(`/verifier/assign/subject-units${params}`);
  }

  async getVerifierSubjects(batchId = null) {
    const params = batchId ? `?batchId=${batchId}` : '';
    return this.request(`/verifier/subjects${params}`);
  }

  async createSubject(name, teacherId, batchId = null, unitNames = []) {
    return this.request('/verifier/subjects', {
      method: 'POST',
      body: JSON.stringify({ name, teacherId, batchId, unitNames }),
    });
  }

  async createAssignmentRequest(fromTeacherId, toTeacherId, subjectId, reason, unitIds = [], batchId = null) {
    return this.request('/verifier/assign/request', {
      method: 'POST',
      body: JSON.stringify({ fromTeacherId, toTeacherId, subjectId, reason, unitIds, batchId }),
    });
  }

  async getVerifierAssignments(status = 'all', skipCache = false) {
    const options = skipCache ? { cacheMaxAge: 0 } : {};
    return this.request(`/verifier/assign/assignments?status=${status}`, options);
  }

  async deleteVerifierAssignment(assignmentId) {
    return this.request(`/verifier/assign/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
  }

  // Admin assignment endpoints
  async getAssignments(status = 'all') {
    return this.request(`/admin/assignments${status !== 'all' ? `?status=${status}` : ''}`);
  }

  async approveAssignment(assignmentId) {
    return this.request(`/admin/assignments/${assignmentId}/approve`, {
      method: 'POST',
    });
  }

  async rejectAssignment(assignmentId, reason) {
    return this.request(`/admin/assignments/${assignmentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getVerifierAdminData(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/verifier/admin-data${params ? `?${params}` : ''}`);
  }

  // Exam endpoints
  async deleteExamBatch(batchId) {
    return this.request(`/verifier/exam/batches/${batchId}`, {
      method: 'DELETE',
    });
  }

  async getExamBatches(options = {}) {
    return this.request('/verifier/exam/batches', options);
  }

  async getExamSubjects(batchId) {
    return this.request(`/verifier/exam/subjects?batchId=${batchId}`);
  }

  async getExamUnits(subjectId) {
    return this.request(`/verifier/exam/units?subjectId=${subjectId}`, { cacheMaxAge: 0 });
  }

  async toggleExamStatus(unitId, isFinished) {
    return this.request('/verifier/exam/toggle', {
      method: 'POST',
      body: JSON.stringify({ unitId, isFinished })
    });
  }

  async getTimeTableHistory() {
    return this.request('/verifier/time-table/history');
  }

  async deleteTimeTableHistory(id) {
    return this.request(`/verifier/time-table/history/${id}`, {
      method: 'DELETE'
    });
  }

  async applyTimeTableFromImport(entries) {
    return this.request('/verifier/time-table/apply', {
      method: 'POST',
      body: JSON.stringify({ entries })
    });
  }

  // Teacher calendar endpoint
  async getTeacherCalendar(startDate, endDate) {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    return this.request(`/teacher/calendar?startDate=${start}&endDate=${end}`);
  }

  async updateTeacherCalendarDay(date, subjectName, batch) {
    return this.request('/teacher/calendar/day', {
      method: 'PATCH',
      body: JSON.stringify({ date, subjectName, batch })
    });
  }

  // Batch endpoints
  async getBatches() {
    return this.request('/batch', { cacheMaxAge: 0 });
  }

  async createBatch(name, year, description, studentIds = [], teacherIds = []) {
    return this.request('/batch', {
      method: 'POST',
      body: JSON.stringify({ name, year, description, studentIds, teacherIds }),
    });
  }

  async getBatch(batchId) {
    return this.request(`/batch/${batchId}`);
  }

  async updateBatch(batchId, name, year, description, studentIds, teacherIds) {
    return this.request(`/batch/${batchId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, year, description, studentIds, teacherIds }),
    });
  }

  async deleteBatch(batchId) {
    return this.request(`/batch/${batchId}`, {
      method: 'DELETE',
    });
  }

  async getBatchStudents(batchId) {
    return this.request(`/batch/${batchId}/students`);
  }
}

export default new ApiService();
