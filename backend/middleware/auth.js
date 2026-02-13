import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    // Check if user has active session
    if (!req.session || !req.session.userId) {
      console.log(`❌ AUTH FAILED: No session or userId. SessionID: ${req.sessionID}`);
      return res.status(401).json({
        success: false,
        message: 'Not authorized - Please login first'
      });
    }

    // Get user from session
    const user = await User.findById(req.session.userId).select('-password');

    if (!user) {
      // Session exists but user not found - clear session
      req.session.destroy();
      return res.status(401).json({
        success: false,
        message: 'User not found - Session invalid'
      });
    }

    // Attach user to request object
    req.user = {
      id: user._id,
      role: user.role,
      email: user.email
    };

    console.log(`🔐 AUTH DEBUG: User authenticated - ID: ${user._id} Role: ${user.role} URL: ${req.originalUrl}`);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};
