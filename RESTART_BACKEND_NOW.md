# ⚠️ CRITICAL: Restart Backend Server

## The Issue
The `.env` file exists with `JWT_SECRET`, but the backend server was started **before** the `.env` file existed, so it doesn't have the environment variables loaded.

## ✅ Fix: Restart Backend

### Step 1: Stop Backend
In your **backend terminal** (where `npm start` is running):
- Press `Ctrl + C` to stop the server

### Step 2: Restart Backend
```powershell
cd backend
npm start
```

### Step 3: Verify
Check the backend console output. You should see:
- ✅ `MongoDB Connected: ...`
- ✅ `Server running on http://localhost:5000`

### Step 4: Test Login
Go back to your browser and try logging in again. It should work now!

## Why This Happens
When Node.js starts, it reads environment variables from `.env` file **once at startup**. If you create or modify the `.env` file while the server is running, the changes won't be picked up until you restart.

## Current .env File Contents
Your `backend/.env` file has:
```
JWT_SECRET=gfi-tracker-secret-key-change-in-production-2026
MONGODB_URI=mongodb://localhost:27017/gfi-tracker
PORT=5000
JWT_EXPIRE=24h
NODE_ENV=development
```

This looks good! Just restart the backend to load it.
