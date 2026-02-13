# Troubleshooting "Failed to Fetch" in Port Forwarding

## Quick Fix

### Option 1: Use Environment Variable (Recommended)

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://YOUR-ACTUAL-HOSTNAME:5000/api
```

**Examples:**
- If accessing via `http://192.168.1.100:3000`, use: `VITE_API_URL=http://192.168.1.100:5000/api`
- If accessing via `http://localhost:3000`, use: `VITE_API_URL=http://localhost:5000/api`
- If using a forwarded port from a remote server, use the server's IP/hostname

### Option 2: Check Browser Console

1. Open DevTools (F12)
2. Check Console for the API URL being used
3. Verify the URL is correct for your setup

### Option 3: Verify Backend is Accessible

Test if backend is reachable:

```powershell
# Test backend health
curl http://localhost:5000/api/health
# or
Invoke-WebRequest http://localhost:5000/api/health
```

## Common Issues

### Issue 1: Backend Port Not Forwarded

**Problem:** Frontend port is forwarded but backend port (5000) is not.

**Solution:**
- Forward port 5000 as well
- Or update `.env` to point to where backend is accessible

### Issue 2: Vite Proxy Not Working

**Problem:** In development, `/api` proxy might not work with port forwarding.

**Solution:**
- Use direct URL in `.env`: `VITE_API_URL=http://hostname:5000/api`
- Or ensure both frontend (3000) and backend (5000) ports are forwarded

### Issue 3: CORS Error

**Problem:** Browser blocking cross-origin requests.

**Solution:**
- Backend CORS is configured to allow all origins in development
- Check browser console for CORS errors
- Ensure backend is running and accessible

## Debug Steps

1. **Check API URL in console:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for: "Auto-detected API URL:" or "Using VITE_API_URL:"

2. **Check Network tab:**
   - Open DevTools → Network tab
   - Try to login
   - See what URL is being called
   - Check if request fails and why

3. **Verify Backend:**
   ```powershell
   cd backend
   npm start
   ```
   Should see: `Server running on port 5000`

4. **Test Backend Directly:**
   - Open: `http://YOUR-HOSTNAME:5000/api/health`
   - Should return: `{"success":true,"message":"GFI Tracker API is running"}`

## Port Forwarding Examples

### VS Code Port Forwarding

1. Forward port 3000 (frontend)
2. Forward port 5000 (backend)
3. Access via forwarded URL
4. Create `.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

### SSH Tunnel

```bash
# Terminal 1: Frontend
ssh -L 3000:localhost:3000 user@server

# Terminal 2: Backend
ssh -L 5000:localhost:5000 user@server

# Create .env
VITE_API_URL=http://localhost:5000/api
```

### Remote Server

If accessing via remote server IP:

```env
VITE_API_URL=http://SERVER-IP:5000/api
```

## Still Not Working?

1. Check if backend is actually running
2. Check if port 5000 is accessible from your browser
3. Check browser console for exact error message
4. Verify firewall isn't blocking port 5000
5. Try accessing backend URL directly in browser
