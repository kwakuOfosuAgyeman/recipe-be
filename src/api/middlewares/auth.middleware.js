// src/api/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const ErrorResponse = require('../../utils/errorResponse');
const asyncHandler = require('../../utils/asyncHandler');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    // Check if user is active
    if (!req.user.isActive) {
      return next(new ErrorResponse('User account is deactivated', 401));
    }
    
    // Update last active
    req.user.lastActive = Date.now();
    await req.user.save({ validateBeforeSave: false });
    
    next();
  } catch (error) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// Check subscription status
exports.requireSubscription = (level = 'premium') => {
  return (req, res, next) => {
    if (req.user.subscription.status !== level && req.user.role !== 'admin') {
      return next(
        new ErrorResponse(
          `This feature requires a ${level} subscription`,
          403
        )
      );
    }
    next();
  };
};

// Optional authentication - doesn't fail if no token
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token invalid but continue without user
      req.user = null;
    }
  }
  
  next();
});