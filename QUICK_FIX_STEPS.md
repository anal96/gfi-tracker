# 🚨 QUICK FIX - "Failed to Fetch" CORS Error

## Problem
Browser is using **cached JavaScript** that tries to connect directly to port 5000 instead of using the Vite proxy.

## ✅ FIX IN 3 STEPS:

### Step 1: Clear Browser Cache (CRITICAL!)
1. Press `F12` to open DevTools
2. Right-click the **refresh button** in browser
3. Click **"Empty Cache and Hard Reload"**
   
   OR
   
   Press `Ctrl + Shift + Delete` → Select "Cached images and files" → Clear

### Step 2: Unregister Service Workers
1. In DevTools (F12), go to **Application** tab
2. Click **Service Workers** (left sidebar)
3. Click **Unregister** for any service workers listed
4. Check **"Update on reload"** if shown
5. **Close DevTools and refresh page**

### Step 3: Restart Both Servers

**Terminal 1 - Backend:**
```powershell
# Press Ctrl+C to stop, then:
cd backend
npm start
```
Wait for: `Server running on port 5000`

**Terminal 2 - Frontend:**
```powershell
# Press Ctrl+C to stop, then:
npm run dev
```

## ✅ Verify It's Fixed

After refreshing, check browser console - you should see:
- ✅ `🔗 Using Proxy: YES ✅ (no CORS issues)`
- ✅ `📤 API Request: POST /api/auth/login` (NOT `http://localhost:5000/api/auth/login`)
- ✅ In your **frontend terminal**, you should see: `🔄 Proxying: POST /api/auth/login → http://localhost:5000/api/auth/login`

## ⚠️ If Still Not Working

Try **Incognito/Private Window** - this bypasses all cache:
- Press `Ctrl + Shift + N` (Chrome) or `Ctrl + Shift + P` (Firefox)
- Navigate to `http://localhost:3000`
- Try logging in

If it works in incognito, the issue is browser cache. Clear it completely!
