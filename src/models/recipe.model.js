// src/models/recipe.model.js
const mongoose = require('mongoose');
const slugify = require('slugify');

const recipeSchema = new mongoose.Schema({
  name: {
    en: {
      type: String,
      required: [true, 'Recipe name in English is required'],
      trim: true,
      maxlength: [100, 'Recipe name cannot exceed 100 characters']
    },
    tw: String, // Twi
    ee: String, // Ewe
    ga: String  // Ga
  },
  slug: {
    type: String,
    unique: true
  },
  description: {
    en: {
      type: String,
      required: [true, 'Recipe description in English is required'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    tw: String,
    ee: String,
    ga: String
  },
  ingredients: [{
    item: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true,
      enum: ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece', 'bunch', 
             'margarine_tin', 'olonka', 'american_tin'] // Include local measurements
    },
    localMarketName: String,
    estimatedPrice: {
      amount: Number,
      currency: {
        type: String,
        default: 'GHS'
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    optional: {
      type: Boolean,
      default: false
    },
    substitutes: [String],
    notes: String
  }],
  instructions: [{
    step: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    imageUrl: String,
    videoUrl: String,
    duration: Number, // in minutes
    temperature: {
      value: Number,
      unit: {
        type: String,
        enum: ['C', 'F']
      }
    },
    tips: [String]
  }],
  nutrition: {
    servingSize: String,
    calories: Number,
    protein: Number, // grams
    carbs: Number,
    fat: Number,
    fiber: Number,
    sugar: Number,
    sodium: Number, // mg
    cholesterol: Number,
    vitamins: [{
      name: String,
      amount: Number,
      unit: String,
      percentDailyValue: Number
    }]
  },
  prepTime: {
    type: Number, // minutes
    required: true
  },
  cookTime: {
    type: Number, // minutes
    required: true
  },
  totalTime: {
    type: Number // auto-calculated
  },
  servings: {
    type: Number,
    required: true,
    default: 4
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  categories: [{
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink', 'soup', 'salad']
  }],
  cuisineType: {
    type: String,
    enum: ['ghanaian', 'african', 'continental', 'fusion'],
    default: 'ghanaian'
  },
  mealType: [{
    type: String,
    enum: ['appetizer', 'main', 'side', 'dessert', 'beverage']
  }],
  occasionType: [{
    type: String,
    enum: ['everyday', 'party', 'wedding', 'funeral', 'christmas', 'easter', 
           'independence', 'festival', 'outdooring']
  }],
  region: {
    type: String,
    enum: ['greater_accra', 'ashanti', 'western', 'central', 'eastern', 
           'volta', 'northern', 'upper_east', 'upper_west', 'brong_ahafo', 
           'oti', 'bono_east', 'ahafo', 'western_north', 'north_east', 'savannah']
  },
  tags: [String],
  cookingMethod: [{
    type: String,
    enum: ['boiling', 'frying', 'grilling', 'baking', 'steaming', 'roasting', 
           'stewing', 'smoking', 'raw']
  }],
  equipment: [{
    name: String,
    optional: Boolean,
    alternatives: [String]
  }],
  images: [{
    url: String,
    caption: String,
    isMain: {
      type: Boolean,
      default: false
    }
  }],
  videoUrl: String,
  videoEmbedCode: String,
  estimatedCost: {
    amount: Number,
    currency: {
      type: String,
      default: 'GHS'
    },
    pricePerServing: Number,
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  source: {
    type: String,
    enum: ['original', 'traditional', 'adapted', 'user_submitted'],
    default: 'original'
  },
  attribution: String,
  featured: {
    type: Boolean,
    default: false
  },
  premium: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  publishedAt: Date,
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  views: {
    type: Number,
    default: 0
  },
  saves: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  cookedCount: {
    type: Number,
    default: 0
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
recipeSchema.index({ slug: 1 });
recipeSchema.index({ 'name.en': 'text', 'description.en': 'text', tags: 'text' });
recipeSchema.index({ categories: 1 });
recipeSchema.index({ region: 1 });
recipeSchema.index({ 'ratings.average': -1 });
recipeSchema.index({ views: -1 });
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ featured: 1, published: 1 });

// Pre-save middleware
recipeSchema.pre('save', function(next) {
  // Generate slug
  if (this.isModified('name')) {
    this.slug = slugify(this.name.en, { lower: true });
  }
  
  // Calculate total time
  this.totalTime = this.prepTime + this.cookTime;
  
  // Calculate price per serving
  if (this.estimatedCost && this.estimatedCost.amount) {
    this.estimatedCost.pricePerServing = this.estimatedCost.amount / this.servings;
  }
  
  next();
});

// Virtual for isNew (recipe created in last 7 days)
recipeSchema.virtual('isNew').get(function() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return this.createdAt > weekAgo;
});

// Virtual for isTrending (high views in last 30 days)
recipeSchema.virtual('isTrending').get(function() {
  return this.views > 1000 && this.ratings.average >= 4;
});

// Static methods
recipeSchema.statics.getFeatured = function() {
  return this.find({ featured: true, published: true })
    .populate('author', 'name avatar')
    .limit(10)
    .sort('-createdAt');
};

recipeSchema.statics.getPopular = function() {
  return this.find({ published: true })
    .populate('author', 'name avatar')
    .sort('-views -ratings.average')
    .limit(20);
};

recipeSchema.statics.searchRecipes = async function(query, filters = {}) {
  const searchCriteria = { published: true };
  
  if (query) {
    searchCriteria.$text = { $search: query };
  }
  
  if (filters.category) {
    searchCriteria.categories = filters.category;
  }
  
  if (filters.region) {
    searchCriteria.region = filters.region;
  }
  
  if (filters.difficulty) {
    searchCriteria.difficulty = filters.difficulty;
  }
  
  if (filters.maxCost) {
    searchCriteria['estimatedCost.amount'] = { $lte: filters.maxCost };
  }
  
  if (filters.maxTime) {
    searchCriteria.totalTime = { $lte: filters.maxTime };
  }
  
  if (filters.dietary) {
    searchCriteria.tags = { $in: filters.dietary };
  }
  
  return this.find(searchCriteria)
    .populate('author', 'name avatar')
    .sort(filters.sort || '-createdAt');
};

module.exports = mongoose.model('Recipe', recipeSchema);