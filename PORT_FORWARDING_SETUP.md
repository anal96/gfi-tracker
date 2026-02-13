# Port Forwarding Setup Guide

## Problem
When accessing the app through port forwarding (remote server, SSH tunnel, etc.), the login fails with "Failed to fetch" because the API URL is hardcoded to `localhost:5000`.

## Solution
The app now automatically detects the API URL based on your current hostname and port. It supports:
- ✅ Local development (localhost)
- ✅ Port forwarding (remote access)
- ✅ Production deployment
- ✅ Vite proxy (for development)

## Setup Instructions

### Option 1: Automatic Detection (Recommended)
The app automatically detects the API URL. Just make sure both servers are running:

1. **Start Backend:**
   ```powershell
   cd backend
   npm start
   ```

2. **Start Frontend:**
   ```powershell
   npm run dev
   ```

The frontend will automatically use `/api` which proxies to `localhost:5000` in development.

### Option 2: Manual Configuration

If automatic detection doesn't work, create a `.env` file in the root directory:

```env
VITE_API_URL=http://your-actual-hostname:5000/api
```

**Examples:**
- Local: `VITE_API_URL=http://localhost:5000/api`
- Remote server: `VITE_API_URL=http://192.168.1.100:5000/api`
- Domain: `VITE_API_URL=http://api.example.com/api`

### Option 3: Using Vite Proxy (Development)

The Vite proxy is already configured. When running `npm run dev`, all requests to `/api/*` will be automatically proxied to `http://localhost:5000/api`.

This means:
- Frontend: `http://localhost:3000` (or your forwarded port)
- API calls go to: `/api/auth/login` → automatically proxied to `http://localhost:5000/api/auth/login`

## Troubleshooting

### "Failed to fetch" Error

1. **Check if backend is running:**
   ```powershell
   cd backend
   npm start
   ```
   You should see: `Server running on port 5000`

2. **Check if frontend can reach backend:**
   - Open browser DevTools (F12) → Network tab
   - Try logging in
   - Check if the request goes to the correct URL

3. **For port forwarding:**
   - Make sure the backend port (5000) is also forwarded
   - Update `.env` with the correct hostname/ip

4. **Check CORS:**
   - Backend CORS is configured to allow all origins in development
   - If issues persist, check browser console for CORS errors

### Port Forwarding Examples

**SSH Tunnel:**
```bash
# Forward frontend port
ssh -L 3000:localhost:3000 user@remote-server

# Forward backend port
ssh -L 5000:localhost:5000 user@remote-server
```

**VS Code Port Forwarding:**
1. Open Ports tab
2. Forward port 3000 (frontend)
3. Forward port 5000 (backend)
4. Access through the forwarded URL

## How It Works

1. **Development Mode:**
   - Uses Vite proxy: `/api` → `http://localhost:5000/api`
   - No configuration needed

2. **Production/Port Forwarding:**
   - Auto-detects: Uses same protocol and hostname as frontend
   - If frontend is `http://192.168.1.100:3000`, API becomes `http://192.168.1.100:5000/api`

3. **Manual Override:**
   - Set `VITE_API_URL` in `.env` to override auto-detection
