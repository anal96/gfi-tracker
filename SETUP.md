# GFI Tracker - Setup Guide

## Quick Start

### Step 1: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 2: Set Up MongoDB

#### Option A: Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service:
   ```bash
   # Windows
   net start MongoDB
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

#### Option B: MongoDB Atlas (Cloud)
1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get connection string

### Step 3: Configure Environment

Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gfi-tracker
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gfi-tracker

JWT_SECRET=change-this-to-a-random-secret-key-in-production
JWT_EXPIRE=24h
NODE_ENV=development
```

**Important**: Change `JWT_SECRET` to a random string in production!

### Step 4: Seed the Database

```bash
cd backend
node scripts/seed.js
cd ..
```

This creates:
- **Admin**: admin@gfi.com / admin123
- **Teacher 1**: teacher1@gfi.com / teacher123
- **Teacher 2**: teacher2@gfi.com / teacher123

### Step 5: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Step 6: Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

Login with one of the seeded accounts!

## Troubleshooting

### MongoDB Connection Failed
- Check if MongoDB is running: `mongosh` or check service status
- Verify connection string in `.env`
- For Atlas: Check IP whitelist and credentials

### Port Already in Use
- Change `PORT` in `backend/.env` (frontend will need API URL update)
- Or kill process using port 5000/3000

### Module Not Found Errors
- Run `npm install` in both root and backend directories
- Delete `node_modules` and reinstall if needed

### Authentication Issues
- Clear browser localStorage
- Check JWT_SECRET in backend/.env
- Verify backend is running on correct port

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper CORS origins
4. Use MongoDB Atlas or managed MongoDB
5. Set up process manager (PM2, etc.)

### Frontend
1. Update `VITE_API_URL` to production API
2. Build: `npm run build`
3. Serve from `dist/` folder
4. Configure HTTPS for PWA

## Next Steps

- [ ] Add more teachers via Admin dashboard
- [ ] Assign subjects to teachers
- [ ] Start tracking units and time slots
- [ ] View analytics in Admin dashboard
