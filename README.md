# GFI Tracker - Educational Portion Tracker PWA

A comprehensive Progressive Web Application (PWA) for tracking unit-wise teaching progress and actual working hours of teachers with role-based access control.

## 🚀 Features

### Teacher Features
- ✅ Daily time slot tracking (9 AM - 3 PM)
- ✅ Start/Complete unit tracking with system-calculated timers
- ✅ Real-time elapsed time display
- ✅ Subject and unit management
- ✅ Only one active unit at a time (enforced)

### Admin Features
- ✅ View all teachers' progress
- ✅ Metrics dashboard (total teachers, completed units, in-progress units, avg hours)
- ✅ Progress visualization by subject
- ✅ Filter by teacher, subject, and date range
- ✅ Export reports to CSV
- ✅ Identify delayed units (taking longer than 12 hours)

### System Features
- ✅ JWT-based authentication
- ✅ Role-based access control (Admin/Teacher)
- ✅ MongoDB data persistence
- ✅ PWA support (installable, offline-capable)
- ✅ Dark mode support
- ✅ Responsive design

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd "gfi tracker"
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Install Backend Dependencies
```bash
cd backend
npm install
```

### 4. Set Up Environment Variables

Create `backend/.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gfi-tracker
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=24h
NODE_ENV=development
```

For MongoDB Atlas, use:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gfi-tracker
```

Create `frontend/.env` file (optional, for custom API URL):
```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Seed Database (Optional)

Run the seed script to create sample data:
```bash
cd backend
node scripts/seed.js
```

This will create:
- Admin user: `admin@gfi.com` / `admin123`
- Teacher 1: `teacher1@gfi.com` / `teacher123`
- Teacher 2: `teacher2@gfi.com` / `teacher123`

## 🚀 Running the Application

### Start Backend Server
```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:5000`

### Start Frontend Development Server
```bash
npm run dev
```

Frontend will run on `http://localhost:3000` (or the port specified in vite.config.ts)

## 📁 Project Structure

```
gfi-tracker/
├── backend/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── models/
│   │   ├── User.js            # User model
│   │   ├── Subject.js         # Subject model
│   │   ├── Unit.js            # Unit model
│   │   ├── UnitLog.js         # Unit tracking log
│   │   └── DailyTimeSlot.js   # Daily time slot tracking
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   └── validator.js       # Input validation
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── teacher.js         # Teacher dashboard routes
│   │   └── admin.js           # Admin dashboard routes
│   ├── scripts/
│   │   └── seed.js            # Database seeding
│   └── server.js              # Express server
├── src/
│   ├── components/
│   │   ├── Login.tsx          # Login page
│   │   ├── TeacherDashboard.tsx
│   │   ├── AdminDashboard.tsx
│   │   └── ...
│   ├── services/
│   │   └── api.js             # API service layer
│   └── App.tsx                # Main app component
└── package.json
```

## 🔐 Authentication

The system uses JWT (JSON Web Tokens) for authentication:

1. User logs in with email and password
2. Backend validates credentials
3. JWT token is issued and stored in localStorage
4. Token is sent with each API request in Authorization header
5. Token expires after 24 hours (configurable)

## 📊 Database Models

### User
- Email, password (hashed), name, role (admin/teacher)
- References to assigned subjects

### Subject
- Name, color, teacher reference
- Array of unit references

### Unit
- Name, subject reference, order

### UnitLog
- Unit, teacher, subject references
- startTime, endTime (timestamps)
- totalMinutes (calculated)
- status (not-started, in-progress, completed)

### DailyTimeSlot
- Teacher, date
- Array of slot objects (checked, locked)
- totalHours (calculated)

## 🎯 Business Logic

### Unit Tracking
- ✅ Only one unit can be in progress at a time per teacher
- ✅ Start time is system-calculated (when "Start" is clicked)
- ✅ End time is system-calculated (when "Complete" is clicked)
- ✅ Total time is automatically calculated
- ✅ Completed units cannot be reopened

### Time Slots
- ✅ Only current day's slots can be edited
- ✅ Once checked, slots are locked (cannot be unchecked)
- ✅ Total hours = sum of checked slots

### Multi-day Units
- ✅ Units can span multiple days
- ✅ Total time includes all days from start to completion

## 🧪 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register (Admin only)
- `GET /api/auth/me` - Get current user

### Teacher
- `GET /api/teacher/dashboard` - Get dashboard data
- `POST /api/teacher/time-slots` - Update time slot
- `POST /api/teacher/units/:unitId/start` - Start unit
- `POST /api/teacher/units/:unitId/complete` - Complete unit

### Admin
- `GET /api/admin/dashboard` - Get admin dashboard
- `GET /api/admin/progress` - Get progress visualization data
- `GET /api/admin/teachers` - Get all teachers

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Role-based route protection
- Input validation
- CORS configuration

## 📱 PWA Features

- Service worker for offline support
- Web app manifest for installation
- Cached static assets
- Install prompt

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running locally or MongoDB Atlas connection string is correct
- Check firewall settings if using remote MongoDB

### CORS Errors
- Verify backend CORS is configured correctly
- Check API URL in frontend environment variables

### Authentication Issues
- Clear localStorage and try logging in again
- Check JWT_SECRET in backend .env file

## 📝 License

This project is private and proprietary.

## 👥 Support

For issues or questions, please contact the development team.

---

**Built with ❤️ using React, Express, MongoDB, and TypeScript**
