# 🌐 Port Forwarding Setup Guide

## ✅ Fixed: Port Forwarding Now Works!

The frontend now automatically uses the Vite proxy when port forwarding is detected, ensuring login works correctly.

## 🔧 How It Works:

1. **Frontend (Vite Dev Server)**:
   - Runs on `localhost:3000` locally
   - Can be forwarded to external URL (e.g., `abc123.devtunnels.ms:3000`)
   - Uses `/api` proxy for all backend requests

2. **Backend (Express Server)**:
   - Runs on `localhost:5000` locally
   - **DO NOT forward backend port** - it stays on localhost
   - Accepts connections from Vite proxy

3. **The Proxy Magic**:
   - When frontend makes request to `/api/*`, Vite proxy intercepts
   - Vite proxy forwards to `http://localhost:5000/api/*`
   - This works even when frontend is accessed via external URL!

## 🚀 Setup Steps:

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
npm start
```
**Wait for:** `Server running on http://localhost:5000`

### Step 2: Start Frontend (Terminal 2)
```bash
npm run dev
```
**Wait for:** `Local: http://localhost:3000`

### Step 3: Forward Frontend Port Only
- Forward **port 3000** (frontend) to external URL
- **DO NOT forward port 5000** (backend stays on localhost)
- Access frontend via external URL (e.g., `https://abc123.devtunnels.ms:3000`)

### Step 4: Test Login
- Open external URL in browser
- Try logging in
- Should work! The proxy handles everything

## ✅ What Was Fixed:

1. **API Service Detection**: Now detects port forwarding and always uses proxy in dev mode
2. **Proxy Enforcement**: Forces proxy usage even when hostname is not localhost
3. **Error Messages**: Updated to explain port forwarding setup

## 🐛 Troubleshooting:

**Problem: "Cannot connect to backend server" with port forwarding**

**Solution:**
1. ✅ Make sure backend is running on `localhost:5000` (not forwarded)
2. ✅ Make sure frontend is running on `localhost:3000` (can be forwarded)
3. ✅ Check browser console - should see: `Using Proxy: YES ✅ (works with port forwarding)`
4. ✅ Check Vite terminal - should see proxy logs: `🔄 Proxying: POST /api/auth/login`

**Problem: CORS errors**

**Solution:**
- Backend CORS already allows all origins
- If still getting CORS, check browser console shows proxy is being used
- Hard refresh browser (Ctrl+Shift+R) to clear cache

**Problem: Session cookies not working**

**Solution:**
- Cookies work via proxy (same-origin from browser's perspective)
- Check browser DevTools → Application → Cookies
- Should see `gfi-tracker.sid` cookie set after login

## 📝 Key Points:

- ✅ **Frontend can be forwarded** - Works with dev tunnels, ngrok, etc.
- ❌ **Backend should NOT be forwarded** - Stays on localhost:5000
- ✅ **Proxy handles everything** - Frontend → Proxy → Backend (localhost)
- ✅ **Sessions work** - Cookies handled automatically via proxy

## 🎉 Result:

Login now works correctly whether accessing frontend via:
- `http://localhost:3000` (local)
- `https://abc123.devtunnels.ms:3000` (port forwarded)
- Any external URL (as long as port 3000 is forwarded)

The proxy automatically routes all `/api/*` requests to the backend on localhost!
