// src/services/sms.service.js
const twilio = require('twilio');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.from = process.env.TWILIO_PHONE_NUMBER;
  }
  
  async sendSMS(to, message) {
    try {
      // Format Ghana phone number
      const formattedNumber = this.formatPhoneNumber(to);
      
      const result = await this.client.messages.create({
        body: message,
        from: this.from,
        to: formattedNumber
      });
      
      logger.info(`SMS sent successfully: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`SMS sending failed: ${error.message}`);
      throw error;
    }
  }
  
  formatPhoneNumber(phone) {
    // Remove any spaces or special characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('233')) {
      if (cleaned.startsWith('0')) {
        cleaned = '233' + cleaned.substring(1);
      } else {
        cleaned = '233' + cleaned;
      }
    }
    
    return '+' + cleaned;
  }
  
  async sendOTP(phone, otp) {
    const message = `Your Ghana Recipes verification code is: ${otp}. Valid for 10 minutes.`;
    return this.sendSMS(phone, message);
  }
  
  async sendMealReminder(phone, mealType, recipeName) {
    const message = `Time to cook! Your ${mealType} today: ${recipeName}. Open Ghana Recipes app for the recipe.`;
    return this.sendSMS(phone, message);
  }
}

module.exports = new SMSService();