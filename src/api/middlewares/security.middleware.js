// src/api/middlewares/security.middleware.js
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Rate limiting
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: message
      });
    }
  });
};

// Speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // allow 100 requests per windowMs
  delayMs: 500 // begin adding 500ms delay per request above 100
});

// Different rate limiters for different endpoints
// Different rate limiters for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests, please try again later'
);

const searchLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // limit each IP to 30 search requests per minute
  'Too many search requests, please try again later'
);

// XSS sanitization function
const sanitizeInput = (data) => {
  if (typeof data === 'string') {
    return xss(data);
  } else if (typeof data === 'object') {
    for (let key in data) {
      if (data.hasOwnProperty(key)) {
        data[key] = sanitizeInput(data[key]);
      }
    }
  }
  return data;
};

// Input sanitization middleware
const sanitizeMiddleware = (req, res, next) => {
  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);
  next();
};

module.exports = {
  helmet,
  mongoSanitize,
  hpp,
  authLimiter,
  apiLimiter,
  searchLimiter,
  speedLimiter,
  sanitizeMiddleware
};