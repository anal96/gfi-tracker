# Quick Start Guide - Fix "Unauthorized" Error

## The Issue
You're getting "Unauthorized" because the **backend server is not running**.

## Solution

### Step 1: Start MongoDB
Make sure MongoDB is running:

**Windows:**
```powershell
# Check if MongoDB is running
Get-Service MongoDB

# If not running, start it:
net start MongoDB
```

**Or use MongoDB as a service:**
- Open Services (Win + R, type `services.msc`)
- Find "MongoDB" service
- Right-click → Start

### Step 2: Start Backend Server

Open a **NEW terminal window** and run:

```powershell
cd "D:\gfi tracker\backend"
npm start
```

You should see:
```
MongoDB Connected: ...
Server running on port 5000
```

### Step 3: Seed Database (First Time Only)

If you haven't seeded the database yet, run this in another terminal:

```powershell
cd "D:\gfi tracker\backend"
node scripts/seed.js
```

This creates:
- **Admin**: `admin@gfi.com` / `admin123`
- **Teacher**: `teacher1@gfi.com` / `teacher123`

### Step 4: Test Login

1. Make sure backend is running (Step 2)
2. Go to `http://localhost:3000`
3. Login with:
   - Email: `teacher1@gfi.com`
   - Password: `teacher123`

## Troubleshooting

### If MongoDB Connection Fails:
```powershell
# Check MongoDB is installed and running
mongosh
```

If `mongosh` doesn't work, MongoDB might not be installed. You can:
1. Install MongoDB locally, OR
2. Use MongoDB Atlas (cloud) - update `backend/.env` with connection string

### If Backend Won't Start:
```powershell
cd backend
npm install  # Reinstall dependencies
npm start
```

### Check Backend is Running:
Open browser and go to: `http://localhost:5000/api/health`

You should see: `{"success":true,"message":"GFI Tracker API is running"}`

## Keep Both Servers Running

You need **TWO terminals**:

**Terminal 1 - Backend:**
```powershell
cd "D:\gfi tracker\backend"
npm start
```

**Terminal 2 - Frontend:**
```powershell
cd "D:\gfi tracker"
npm run dev
```

Both must be running for the app to work!
