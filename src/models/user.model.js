// src/models/user.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^(\+233|0)[0-9]{9}$/, 'Please provide a valid Ghana phone number']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'chef', 'admin'],
    default: 'user'
  },
  subscription: {
    status: {
      type: String,
      enum: ['free', 'premium', 'cancelled'],
      default: 'free'
    },
    plan: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: null
    },
    startDate: Date,
    endDate: Date,
    paymentMethod: String,
    autoRenew: {
      type: Boolean,
      default: true
    }
  },
  preferences: {
    dietary: [{
      type: String,
      enum: ['vegetarian', 'vegan', 'halal', 'gluten-free', 'dairy-free', 'nut-free']
    }],
    allergies: [String],
    favoriteCategories: [String],
    preferredRegions: [String],
    servingSize: {
      type: Number,
      default: 4
    },
    budgetPerMeal: {
      type: Number,
      default: 20 // GHS
    },
    language: {
      type: String,
      enum: ['en', 'tw', 'ee', 'ga'],
      default: 'en'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true},
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  },
  favoriteRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  createdRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  savedMealPlans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MealPlan'
  }],
  cookingHistory: [{
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe'
    },
    cookedAt: {
      type: Date,
      default: Date.now
    },
    rating: Number,
    notes: String
  }],
  points: {
    type: Number,
    default: 0
  },
  achievements: [{
    type: String,
    earnedAt: Date
  }],
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full avatar URL
userSchema.virtual('avatarUrl').get(function() {
  if (this.avatar) {
    return `${process.env.CLOUDINARY_URL}${this.avatar}`;
  }
  return null;
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email,
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

userSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

module.exports = mongoose.model('User', userSchema);