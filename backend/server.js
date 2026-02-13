import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import session from 'express-session';
import connectDB from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import teacherRoutes from './routes/teacher.js';
import adminRoutes from './routes/admin.js';
import verifierRoutes from './routes/verifier.js';
import batchRoutes from './routes/batch.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Trust proxy for secure cookies and sessions behind ngrok/tunnels/Vite proxy
app.set('trust proxy', 1);

// CORS - Allow ALL origins with credentials for session cookies
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins - no restrictions in development
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Enable credentials for session cookies
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Explicitly handle preflight requests for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true'); // Allow credentials for sessions
  res.sendStatus(200);
});

app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ limit: '16mb', extended: true }));

// Session configuration - simple in-memory sessions (no JWT_SECRET needed!)
app.use(session({
  name: 'gfi-tracker.sid', // Custom session cookie name
  secret: 'gfi-tracker-session-secret-change-in-production', // Simple secret for session encryption
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true, // Prevents JavaScript access (security)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Helps with CORS and proxy setups
  }
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verifier', verifierRoutes);
app.use('/api/batch', batchRoutes);



// Health check - must be before error handling middleware
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'GFI Tracker API is running',
    auth: 'session-based (no JWT required)',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    session: req.session ? 'session middleware active' : 'session middleware not active'
  });
});

// Root health check (for easier testing)
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'GFI Tracker API is running',
    auth: 'session-based (no JWT required)',
    timestamp: new Date().toISOString()
  });
});

// Serve static assets in production
// Only if we are not in development mode, or if requested by user
const BUILD_PATH = path.join(__dirname, '../build');

// Serve static files from the build folder
app.use(express.static(BUILD_PATH));

// Handle any requests that don't match the API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_PATH, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for port forwarding

app.listen(PORT, HOST, () => {
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`🚀 Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`📡 API accessible at http://localhost:${PORT}/api`);
  console.log(`✅ Authentication: Session-based (NO JWT_SECRET needed)`);
  console.log(`🍪 Session cookies: Enabled`);
  console.log(`═══════════════════════════════════════════════════════`);
});
