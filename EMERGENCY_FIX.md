# 🚨 EMERGENCY FIX - Service Worker & Cache Issue

## The Problem
Your browser has:
1. **Cached old JavaScript** that connects directly to port 5000
2. **Active service worker** intercepting API requests
3. Both causing CORS errors

## ✅ IMMEDIATE FIX (Do This Now):

### Step 1: Open Browser Console (F12)

### Step 2: Run This Command in Console
```javascript
// Force unregister all service workers and clear cache
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
    console.log('Unregistered:', registration.scope);
  }
}).then(function() {
  return caches.keys();
}).then(function(cacheNames) {
  return Promise.all(
    cacheNames.map(function(cacheName) {
      console.log('Deleting cache:', cacheName);
      return caches.delete(cacheName);
    })
  );
}).then(function() {
  console.log('✅ All service workers and caches cleared!');
  console.log('🔄 Now reload the page (Ctrl+R)');
});
```

### Step 3: Hard Refresh
After running the script above, press **Ctrl + Shift + R** (or Cmd + Shift + R on Mac)

### Step 4: Check Console
You should now see:
- ✅ `🔗 API Base URL: /api` (NOT `http://localhost:5000/api`)
- ✅ `📤 API Request: POST /api/auth/login` (NOT `http://localhost:5000/api/auth/login`)

### Step 5: If Still Not Working
1. Close the browser completely
2. Reopen browser
3. Go to `http://localhost:3000`
4. Try again

## Why This Happens
The service worker caches JavaScript files, and even after you update the code, the browser uses the cached version. The fix above clears everything.
