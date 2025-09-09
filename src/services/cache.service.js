// src/services/cache.service.js
const redis = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  async get(key) {
    try {
      const data = await redis.get(key);
      return data;
    } catch (error) {
      logger.error(`Cache get error: ${error.message}`);
      return null;
    }
  }
  
  async set(key, value, ttl = 3600) {
    try {
      await redis.set(key, value, 'EX', ttl);
      return true;
    } catch (error) {
      logger.error(`Cache set error: ${error.message}`);
      return false;
    }
  }
  
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error: ${error.message}`);
      return false;
    }
  }
  
  async clearPattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error(`Cache clear pattern error: ${error.message}`);
      return false;
    }
  }
  
  async exists(key) {
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache exists error: ${error.message}`);
      return false;
    }
  }
  
  async expire(key, ttl) {
    try {
      await redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Cache expire error: ${error.message}`);
      return false;
    }
  }
  
  async incr(key) {
    try {
      const value = await redis.incr(key);
      return value;
    } catch (error) {
      logger.error(`Cache incr error: ${error.message}`);
      return 0;
    }
  }
  
  async hget(key, field) {
    try {
      const value = await redis.hget(key, field);
      return value;
    } catch (error) {
      logger.error(`Cache hget error: ${error.message}`);
      return null;
    }
  }
  
  async hset(key, field, value) {
    try {
      await redis.hset(key, field, value);
      return true;
    } catch (error) {
      logger.error(`Cache hset error: ${error.message}`);
      return false;
    }
  }
  
  async hdel(key, field) {
    try {
      await redis.hdel(key, field);
      return true;
    } catch (error) {
      logger.error(`Cache hdel error: ${error.message}`);
      return false;
    }
  }
}

module.exports = new CacheService();