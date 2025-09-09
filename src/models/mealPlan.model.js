// src/models/mealPlan.model.js
const mongoose = require('mongoose');

const mealPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  servings: {
    type: Number,
    default: 4
  },
  budget: {
    amount: Number,
    currency: {
      type: String,
      default: 'GHS'
    }
  },
  meals: [{
    date: Date,
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack']
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe'
    },
    servings: Number,
    notes: String,
    isCooked: {
      type: Boolean,
      default: false
    }
  }],
  shoppingList: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShoppingList'
  },
  totalCost: Number,
  totalCalories: Number,
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String]
}, {
  timestamps: true
});

module.exports = mongoose.model('MealPlan', mealPlanSchema);