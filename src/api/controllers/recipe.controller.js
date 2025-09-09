// src/api/controllers/recipe.controller.js
const Recipe = require('../../models/recipe.model');
const asyncHandler = require('../../utils/asyncHandler');
const ErrorResponse = require('../../utils/errorResponse');
const cacheService = require('../../services/cache.service');
const storageService = require('../../services/storage.service');
const analyticsService = require('../../services/analytics.service');

// @desc    Get all recipes
// @route   GET /api/v1/recipes
// @access  Public
exports.getRecipes = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    category,
    region,
    difficulty,
    maxCost,
    maxTime,
    dietary,
    search,
    sort = '-createdAt'
  } = req.query;
  
  // Check cache
  const cacheKey = `recipes:${JSON.stringify(req.query)}`;
  const cachedData = await cacheService.get(cacheKey);
  
  if (cachedData) {
    return res.status(200).json(JSON.parse(cachedData));
  }
  
  // Build query
  const query = { published: true };
  
  if (search) {
    query.$text = { $search: search };
  }
  
  if (category) {
    query.categories = category;
  }
  
  if (region) {
    query.region = region;
  }
  
  if (difficulty) {
    query.difficulty = difficulty;
  }
  
  if (maxCost) {
    query['estimatedCost.amount'] = { $lte: parseFloat(maxCost) };
  }
  
  if (maxTime) {
    query.totalTime = { $lte: parseInt(maxTime) };
  }
  
  if (dietary) {
    query.tags = { $in: dietary.split(',') };
  }
  
  // Add premium filter for free users
  if (!req.user || req.user.subscription.status === 'free') {
    query.premium = false;
  }
  
  // Execute query with pagination
  const recipes = await Recipe.find(query)
    .populate('author', 'name avatar')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Recipe.countDocuments(query);
  
  const response = {
    success: true,
    count: recipes.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: recipes
  };
  
  // Cache for 5 minutes
  await cacheService.set(cacheKey, JSON.stringify(response), 300);
  
  res.status(200).json(response);
});

// @desc    Get single recipe
// @route   GET /api/v1/recipes/:id
// @access  Public
exports.getRecipe = asyncHandler(async (req, res, next) => {
  const recipe = await Recipe.findById(req.params.id)
    .populate('author', 'name avatar bio')
    .populate({
      path: 'reviews',
      populate: {
        path: 'user',
        select: 'name avatar'
      }
    });
  
  if (!recipe) {
    return next(new ErrorResponse('Recipe not found', 404));
  }
  
  // Check if premium recipe and user has access
  if (recipe.premium && (!req.user || req.user.subscription.status === 'free')) {
    return next(new ErrorResponse('Premium subscription required', 403));
  }
  
  // Increment view count
  recipe.views += 1;
  await recipe.save({ validateBeforeSave: false });
  
  // Track analytics
  analyticsService.trackEvent('recipe_view', {
    recipeId: recipe._id,
    userId: req.user?.id,
    category: recipe.categories[0],
    region: recipe.region
  });
  
  res.status(200).json({
    success: true,
    data: recipe
  });
});

// @desc    Create recipe
// @route   POST /api/v1/recipes
// @access  Private
exports.createRecipe = asyncHandler(async (req, res, next) => {
  // Add author to body
  req.body.author = req.user.id;
  
  // Handle image uploads
  if (req.files && req.files.length > 0) {
    const images = await Promise.all(
      req.files.map(async (file) => {
        const result = await storageService.uploadImage(file);
        return {
          url: result.secure_url,
          caption: file.originalname,
          isMain: false
        };
      })
    );
    
    images[0].isMain = true;
    req.body.images = images;
  }
  
  const recipe = await Recipe.create(req.body);
  
  // Update user's created recipes
  await User.findByIdAndUpdate(
    req.user.id,
    { $push: { createdRecipes: recipe._id } }
  );
  
  // Award points for creating recipe
  await authService.awardPoints(req.user.id, 50, 'recipe_created');
  
  res.status(201).json({
    success: true,
    data: recipe
  });
});

// @desc    Update recipe
// @route   PUT /api/v1/recipes/:id
// @access  Private
exports.updateRecipe = asyncHandler(async (req, res, next) => {
  let recipe = await Recipe.findById(req.params.id);
  
  if (!recipe) {
    return next(new ErrorResponse('Recipe not found', 404));
  }
  
  // Check ownership
  if (recipe.author.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this recipe', 403));
  }
  
  // Handle new image uploads
  if (req.files && req.files.length > 0) {
    const newImages = await Promise.all(
      req.files.map(async (file) => {
        const result = await storageService.uploadImage(file);
        return {
          url: result.secure_url,
          caption: file.originalname,
          isMain: false
        };
      })
    );
    
    req.body.images = [...(recipe.images || []), ...newImages];
  }
  
  recipe = await Recipe.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  // Clear cache
  await cacheService.clearPattern('recipes:*');
  
  res.status(200).json({
    success: true,
    data: recipe
  });
});

// @desc    Delete recipe
// @route   DELETE /api/v1/recipes/:id
// @access  Private
exports.deleteRecipe = asyncHandler(async (req, res, next) => {
  const recipe = await Recipe.findById(req.params.id);
  
  if (!recipe) {
    return next(new ErrorResponse('Recipe not found', 404));
  }
  
  // Check ownership
  if (recipe.author.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this recipe', 403));
  }
  
  // Delete images from storage
  if (recipe.images && recipe.images.length > 0) {
    await Promise.all(
      recipe.images.map(image => storageService.deleteImage(image.url))
    );
  }
  
  await recipe.remove();
  
  // Update user's created recipes
  await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { createdRecipes: recipe._id } }
  );
  
  // Clear cache
  await cacheService.clearPattern('recipes:*');
  
  res.status(200).json({
    success: true,
    message: 'Recipe deleted successfully'
  });
});

// @desc    Toggle favorite recipe
// @route   POST /api/v1/recipes/:id/favorite
// @access  Private
exports.toggleFavorite = asyncHandler(async (req, res, next) => {
  const recipe = await Recipe.findById(req.params.id);
  
  if (!recipe) {
    return next(new ErrorResponse('Recipe not found', 404));
  }
  
  const user = await User.findById(req.user.id);
  const isFavorite = user.favoriteRecipes.includes(recipe._id);
  
  if (isFavorite) {
    // Remove from favorites
    user.favoriteRecipes = user.favoriteRecipes.filter(
      id => id.toString() !== recipe._id.toString()
    );
    recipe.saves -= 1;
  } else {
    // Add to favorites
    user.favoriteRecipes.push(recipe._id);
    recipe.saves += 1;
    
    // Award points for first favorite
    if (user.favoriteRecipes.length === 0) {
      await authService.awardPoints(user._id, 5, 'first_favorite');
    }
  }
  
  await user.save();
  await recipe.save({ validateBeforeSave: false });
  
  res.status(200).json({
    success: true,
    isFavorite: !isFavorite
  });
});

// @desc    Add recipe review
// @route   POST /api/v1/recipes/:id/reviews
// @access  Private
exports.addReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
  
  const recipe = await Recipe.findById(req.params.id);
  
  if (!recipe) {
    return next(new ErrorResponse('Recipe not found', 404));
  }
  
  // Check if user has already reviewed
  const existingReview = await Review.findOne({
    recipe: recipe._id,
    user: req.user.id
  });
  
  if (existingReview) {
    return next(new ErrorResponse('You have already reviewed this recipe', 400));
  }
  
  // Create review
  const review = await Review.create({
    recipe: recipe._id,
    user: req.user.id,
    rating,
    comment
  });
  
  // Update recipe ratings
  const reviews = await Review.find({ recipe: recipe._id });
  const avgRating = reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;
  
  recipe.ratings.average = avgRating;
  recipe.ratings.count = reviews.length;
  recipe.reviews.push(review._id);
  
  await recipe.save();
  
  // Award points for review
  await authService.awardPoints(req.user.id, 10, 'recipe_reviewed');
  
  res.status(201).json({
    success: true,
    data: review
  });
});

// @desc    Get featured recipes
// @route   GET /api/v1/recipes/featured
// @access  Public
exports.getFeaturedRecipes = asyncHandler(async (req, res, next) => {
  const cacheKey = 'recipes:featured';
  const cachedData = await cacheService.get(cacheKey);
  
  if (cachedData) {
    return res.status(200).json(JSON.parse(cachedData));
  }
  
  const recipes = await Recipe.getFeatured();
  
  const response = {
    success: true,
    count: recipes.length,
    data: recipes
  };
  
  // Cache for 1 hour
  await cacheService.set(cacheKey, JSON.stringify(response), 3600);
  
  res.status(200).json(response);
});

// @desc    Get popular recipes
// @route   GET /api/v1/recipes/popular
// @access  Public
exports.getPopularRecipes = asyncHandler(async (req, res, next) => {
  const cacheKey = 'recipes:popular';
  const cachedData = await cacheService.get(cacheKey);
  
  if (cachedData) {
    return res.status(200).json(JSON.parse(cachedData));
  }
  
  const recipes = await Recipe.getPopular();
  
  const response = {
    success: true,
    count: recipes.length,
    data: recipes
  };
  
  // Cache for 30 minutes
  await cacheService.set(cacheKey, JSON.stringify(response), 1800);
  
  res.status(200).json(response);
});