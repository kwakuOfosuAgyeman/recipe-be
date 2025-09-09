// src/services/marketPrice.service.js
const axios = require('axios');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class MarketPriceService {
  constructor() {
    // This would integrate with local market APIs or scraped data
    this.priceEndpoint = process.env.MARKET_PRICE_API || 'https://api.ghanamarkets.com';
  }
  
  async getCurrentPrices(region = 'greater_accra') {
    const cacheKey = `market_prices:${region}:${new Date().toDateString()}`;
    
    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      // In production, this would call actual market price APIs
      // For now, we'll use mock data
      const prices = await this.fetchPricesFromSource(region);
      
      // Cache for 6 hours
      await cacheService.set(cacheKey, JSON.stringify(prices), 21600);
      
      return prices;
    } catch (error) {
      logger.error(`Market price fetch error: ${error.message}`);
      return this.getFallbackPrices();
    }
  }
  
  async fetchPricesFromSource(region) {
    // Mock implementation - replace with actual API calls
    return {
      region,
      date: new Date().toISOString(),
      currency: 'GHS',
      items: [
        { name: 'tomatoes', unit: 'kg', price: 8.50, change: 0.5 },
        { name: 'onions', unit: 'kg', price: 6.00, change: -0.3 },
        { name: 'rice', unit: 'kg', price: 12.00, change: 0 },
        { name: 'plantain', unit: 'bunch', price: 15.00, change: 1.0 },
        { name: 'palm_oil', unit: 'liter', price: 18.00, change: 0.2 },
        { name: 'chicken', unit: 'kg', price: 25.00, change: 2.0 },
        { name: 'beef', unit: 'kg', price: 35.00, change: 0 },
        { name: 'fish_tilapia', unit: 'kg', price: 20.00, change: -1.0 },
        { name: 'cassava', unit: 'tuber', price: 5.00, change: 0 },
        { name: 'yam', unit: 'tuber', price: 8.00, change: 0.5 },
        { name: 'gari', unit: 'olonka', price: 10.00, change: 0 },
        { name: 'beans', unit: 'olonka', price: 15.00, change: 1.0 },
        { name: 'groundnut', unit: 'olonka', price: 12.00, change: 0 },
        { name: 'pepper', unit: 'kg', price: 20.00, change: 3.0 },
        { name: 'ginger', unit: 'kg', price: 25.00, change: 0 }
      ]
    };
  }
  
  getFallbackPrices() {
    // Return last known good prices
    return {
      region: 'default',
      date: new Date().toISOString(),
      currency: 'GHS',
      items: []
    };
  }
  
  async calculateRecipeCost(ingredients, region = 'greater_accra') {
    const prices = await this.getCurrentPrices(region);
    let totalCost = 0;
    
    const costedIngredients = ingredients.map(ingredient => {
      const marketPrice = prices.items.find(
        item => item.name === ingredient.item.toLowerCase().replace(/\s+/g, '_')
      );
      
      if (marketPrice) {
        const cost = this.calculateIngredientCost(
          ingredient.amount,
          ingredient.unit,
          marketPrice
        );
        totalCost += cost;
        
        return {
          ...ingredient,
          estimatedPrice: cost
        };
      }
      
      return ingredient;
    });
    
    return {
      ingredients: costedIngredients,
      totalCost,
      priceDate: prices.date
    };
  }
  
  calculateIngredientCost(amount, unit, marketPrice) {
    // Convert units if necessary
    const conversionRates = {
      'g_to_kg': 0.001,
      'ml_to_l': 0.001,
      'tsp_to_tbsp': 0.333,
      'tbsp_to_cup': 0.0625,
      'cup_to_l': 0.237
    };
    
    // Simple calculation - would be more complex in production
    return amount * marketPrice.price;
  }
}

module.exports = new MarketPriceService();