// src/services/email.service.js
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    this.from = `Ghana Recipes <${process.env.FROM_EMAIL}>`;
    this.templates = {};
    this.loadTemplates();
  }
  
  async loadTemplates() {
    const templateDir = path.join(__dirname, '../templates/emails');
    const templates = [
      'welcome',
      'passwordReset',
      'subscription',
      'recipeShared',
      'weeklyDigest'
    ];
    
    for (const template of templates) {
      const html = await fs.readFile(
        path.join(templateDir, `${template}.hbs`),
        'utf8'
      );
      this.templates[template] = handlebars.compile(html);
    }
  }
  
  async sendEmail(to, subject, template, data) {
    try {
      const html = this.templates[template](data);
      
      const mailOptions = {
        from: this.from,
        to,
        subject,
        html
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`Email sending failed: ${error.message}`);
      throw error;
    }
  }
  
  async sendWelcomeEmail(user, verificationToken) {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    
    return this.sendEmail(
      user.email,
      'Welcome to Ghana Recipes! 🍲',
      'welcome',
      {
        name: user.name,
        verificationUrl
      }
    );
  }
  
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    return this.sendEmail(
      user.email,
      'Password Reset Request',
      'passwordReset',
      {
        name: user.name,
        resetUrl
      }
    );
  }
  
  async sendSubscriptionConfirmation(user, plan) {
    return this.sendEmail(
      user.email,
      'Welcome to Ghana Recipes Premium! 🌟',
      'subscription',
      {
        name: user.name,
        plan: plan.name,
        features: plan.features,
        amount: plan.amount
      }
    );
  }
  
  async sendWeeklyDigest(user, recipes, mealPlan) {
    return this.sendEmail(
      user.email,
      'Your Weekly Recipe Digest 📧',
      'weeklyDigest',
      {
        name: user.name,
        recipes,
        mealPlan,
        week: new Date().toLocaleDateString()
      }
    );
  }
}

module.exports = new EmailService();