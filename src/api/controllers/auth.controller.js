// src/api/controllers/auth.controller.js
const User = require('../../models/user.model');
const asyncHandler = require('../../utils/asyncHandler');
const ErrorResponse = require('../../utils/errorResponse');
const emailService = require('../../services/email.service');
const authService = require('../../services/auth.service');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, phone, password } = req.body;
  
  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }]
  });
  
  if (existingUser) {
    return next(new ErrorResponse('User already exists', 400));
  }
  
  // Create user
  const user = await User.create({
    name,
    email,
    phone,
    password
  });
  
  // Generate email verification token
  const verifyToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  
  // Send verification email
  await emailService.sendWelcomeEmail(user, verifyToken);
  
  // Generate tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  
  // Store refresh token in Redis
  await authService.storeRefreshToken(user._id, refreshToken);
  
  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        subscription: user.subscription
      },
      tokens: {
        accessToken,
        refreshToken
      }
    }
  });
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, phone, password } = req.body;
  
  // Validate input
  if ((!email && !phone) || !password) {
    return next(new ErrorResponse('Please provide email/phone and password', 400));
  }
  
  // Find user
  const user = await User.findOne({
    $or: [{ email }, { phone }]
  }).select('+password');
  
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  
  // Check password
  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  
  // Update last active
  user.lastActive = Date.now();
  await user.save({ validateBeforeSave: false });
  
  // Generate tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  
  // Store refresh token in Redis
  await authService.storeRefreshToken(user._id, refreshToken);
  
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatarUrl,
        role: user.role,
        subscription: user.subscription,
        preferences: user.preferences
      },
      tokens: {
        accessToken,
        refreshToken
      }
    }
  });
});

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh
// @access  Public
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token is required', 400));
  }
  
  // Verify refresh token
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  
  // Check if refresh token exists in Redis
  const storedToken = await authService.getRefreshToken(decoded.id);
  
  if (!storedToken || storedToken !== refreshToken) {
    return next(new ErrorResponse('Invalid refresh token', 401));
  }
  
  // Find user
  const user = await User.findById(decoded.id);
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }
  
  // Generate new access token
  const newAccessToken = user.generateAuthToken();
  
  res.status(200).json({
    success: true,
    data: {
      accessToken: newAccessToken
    }
  });
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  // Remove refresh token from Redis
  await authService.removeRefreshToken(req.user.id);
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Verify email
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() }
  });
  
  if (!user) {
    return next(new ErrorResponse('Invalid or expired verification token', 400));
  }
  
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  const user = await User.findOne({ email });
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }
  
  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });
  
  // Send reset email
  await emailService.sendPasswordResetEmail(user, resetToken);
  
  res.status(200).json({
    success: true,
    message: 'Password reset email sent'
  });
});

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpire: { $gt: Date.now() }
  });
  
  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset token', 400));
  }
  
  // Set new password
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpire = undefined;
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Password reset successful'
  });
});