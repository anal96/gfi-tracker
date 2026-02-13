# 🚀 Backend Setup - Fix "Illegal arguments" Error

## The Problem
You're getting: `Error: Illegal arguments: string, undefined`

This means **JWT_SECRET is not set** in your backend environment variables.

## ✅ Quick Fix

### Step 1: Create `.env` file in backend folder

Create a file named `.env` in the `backend` folder with this content:

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
MONGODB_URI=mongodb://localhost:27017/gfi-tracker
```

**Or generate a secure random key:**
```powershell
# Run this in PowerShell to generate a secure random key:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then copy the output and use it as your JWT_SECRET.

### Step 2: Restart Backend

```powershell
# In backend terminal, press Ctrl+C to stop
# Then restart:
cd backend
npm start
```

### Step 3: Verify Setup

Check backend console - you should see:
- ✅ `MongoDB Connected: ...`
- ✅ `Server running on http://localhost:5000`

### Step 4: Try Login Again

The login should now work!

## 📋 Full .env File Template

Create `backend/.env` with:

```env
# JWT Secret - MUST be set for login to work
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/gfi-tracker

# Optional: Server settings (defaults work fine)
PORT=5000
HOST=0.0.0.0
JWT_EXPIRE=24h
```

## 🔍 Troubleshooting

### If MongoDB is not running:
1. Install MongoDB: https://www.mongodb.com/try/download/community
2. Or use MongoDB Atlas (free cloud): https://www.mongodb.com/cloud/atlas
3. Update MONGODB_URI in .env file

### If you see "No users found":
You may need to seed the database with demo users. Check if there's a seed script:
```powershell
cd backend
npm run seed
```

If that doesn't exist, you can create a user manually or the first admin registration will create one.

## ✅ Success Checklist

- [ ] Created `backend/.env` file
- [ ] Set `JWT_SECRET` in .env
- [ ] Set `MONGODB_URI` in .env
- [ ] Restarted backend server
- [ ] Backend console shows "Server running on port 5000"
- [ ] MongoDB is connected (check backend console)
- [ ] Try login - should work now!
