// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const socketIO = require('socket.io');
const http = require('http');
require('dotenv').config();

const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const errorMiddleware = require('./src/api/middlewares/error.middleware');
const logger = require('./src/utils/logger');

// Import routes
const authRoutes = require('./src/api/routes/auth.routes');
const recipeRoutes = require('./src/api/routes/recipe.routes');
const mealPlanRoutes = require('./src/api/routes/mealPlan.routes');
const shoppingListRoutes = require('./src/api/routes/shoppingList.routes');
const userRoutes = require('./src/api/routes/user.routes');
const paymentRoutes = require('./src/api/routes/payment.routes');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

// Connect to databases
connectDB();
connectRedis();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/recipes', recipeRoutes);
app.use('/api/v1/meal-plans', mealPlanRoutes);
app.use('/api/v1/shopping-lists', shoppingListRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Swagger documentation
if (process.env.NODE_ENV === 'development') {
  const swaggerJsDoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');
  const swaggerOptions = require('./src/config/swagger');
  
  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

// Socket.io for real-time features
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  socket.on('join-cooking-session', (recipeId) => {
    socket.join(`recipe-${recipeId}`);
  });
  
  socket.on('cooking-step-complete', (data) => {
    socket.to(`recipe-${data.recipeId}`).emit('user-completed-step', data);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use(errorMiddleware);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = { app, io };