# CORS Error Fix - Quick Guide

## Problem
You're seeing: `Access-Control-Allow-Origin header has a value 'http://localhost:5173' that is not equal to the supplied origin 'http://localhost:3000'`

## Root Cause
1. Frontend is on port 3000, but API service was trying to connect directly to `http://localhost:5000/api`
2. This causes CORS issues because browser blocks cross-origin requests
3. Backend might have been configured for port 5173 (default Vite port) at some point

## Solution Applied

### 1. Fixed API Service (`src/services/api.js`)
- Changed to ALWAYS use Vite proxy (`/api`) when on localhost
- Proxy forwards requests to backend, avoiding CORS entirely

### 2. Fixed Backend CORS (`backend/server.js`)
- Updated to allow ALL origins
- Added explicit preflight handling

## Steps to Fix

### Step 1: Hard Refresh Browser
Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac) to clear cache and reload

### Step 2: Restart Backend Server
The backend needs to be restarted to apply CORS changes:

1. Stop the current backend (Ctrl+C in terminal)
2. Start it again:
   ```powershell
   cd backend
   npm start
   ```

### Step 3: Restart Frontend Dev Server (Optional)
If hard refresh doesn't work:

1. Stop frontend (Ctrl+C)
2. Start again:
   ```powershell
   npm run dev
   ```

## Verification

After restarting, check browser console - you should see:
- `✅ Localhost detected: Using /api proxy (Vite will forward to localhost:5000) - avoids CORS`
- NOT: `✅ Localhost detected: Using http://localhost:5000/api`

## How It Works Now

1. Frontend makes request to: `/api/auth/login`
2. Vite proxy intercepts and forwards to: `http://localhost:5000/api/auth/login`
3. Since proxy is same-origin, NO CORS issues!
4. Backend receives request and responds

## If Still Not Working

1. Check backend is running: `http://localhost:5000/api/health` should return JSON
2. Check Vite proxy is working: Look for proxy logs in terminal when making requests
3. Clear browser cache completely (Ctrl+Shift+Delete)
4. Try incognito/private window
