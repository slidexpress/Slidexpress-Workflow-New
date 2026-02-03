const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ⚡ FAST: In-memory user cache (5 min TTL)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedUser = async (userId) => {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }

  // Fetch from database
  const user = await User.findById(userId)
    .populate('workspace')
    .populate('teamLead', 'name email role')
    .lean();

  if (user) {
    userCache.set(userId, { user, timestamp: Date.now() });
  }

  return user;
};

// Clear user from cache (call after user update)
exports.clearUserCache = (userId) => {
  userCache.delete(userId.toString());
};

// Verify JWT token - OPTIMIZED
exports.authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ⚡ FAST: Use cached user data
    const user = await getCachedUser(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid', error: error.message });
  }
};

// Check if user has required role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied. You do not have permission to perform this action.'
      });
    }
    next();
  };
};

// Super admin only
exports.isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Access denied. Super admin only.' });
  }
  next();
};

// IT admin only
exports.isITAdmin = (req, res, next) => {
  if (req.user.role !== 'it_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Access denied. IT admin only.' });
  }
  next();
};
