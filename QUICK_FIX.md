# Quick Fix for "Failed to Fetch"

## Step 1: Create `.env` file

Create a file named `.env` in the root directory (same folder as `package.json`):

**If accessing via localhost:**
```env
VITE_API_URL=http://localhost:5000/api
```

**If accessing via port forwarding (remote IP):**
```env
VITE_API_URL=http://YOUR-IP-ADDRESS:5000/api
```

**Example:** If you're accessing the app at `http://192.168.1.100:3000`, use:
```env
VITE_API_URL=http://192.168.1.100:5000/api
```

## Step 2: Restart Dev Server

**IMPORTANT:** You must restart the dev server after creating `.env` file!

1. Stop the current server (Press `Ctrl+C`)
2. Start it again:
   ```powershell
   npm run dev
   ```

## Step 3: Verify Backend is Running

In another terminal:
```powershell
cd backend
npm start
```

You should see: `Server running on port 5000`

## Step 4: Test Backend Directly

Open in browser: `http://localhost:5000/api/health`

Should return: `{"success":true,"message":"GFI Tracker API is running"}`

## Still Not Working?

1. **Check browser console (F12)** - Look for API URL logs
2. **Check Network tab** - See what URL is failing
3. **Verify both ports are forwarded** (3000 for frontend, 5000 for backend)
4. **Check firewall** - Make sure port 5000 isn't blocked
