// src/models/shoppingList.model.js
const mongoose = require('mongoose');

const shoppingListSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mealPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MealPlan'
  },
  name: {
    type: String,
    required: true
  },
  items: [{
    ingredient: String,
    quantity: Number,
    unit: String,
    category: {
      type: String,
      enum: ['produce', 'meat', 'dairy', 'pantry', 'frozen', 'bakery', 'other']
    },
    estimatedPrice: Number,
    actualPrice: Number,
    isPurchased: {
      type: Boolean,
      default: false
    },
    purchasedAt: Date,
    notes: String,
    recipes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe'
    }]
  }],
  estimatedTotal: Number,
  actualTotal: Number,
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    }
  }],
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('ShoppingList', shoppingListSchema);