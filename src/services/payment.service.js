// src/services/payment.service.js
const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    this.paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.paystackBaseUrl = 'https://api.paystack.co';
  }
  
  // Initialize payment
  async initializePayment(email, amount, metadata = {}) {
    try {
      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert to pesewas
          currency: 'GHS',
          metadata: {
            ...metadata,
            custom_fields: [
              {
                display_name: 'Platform',
                variable_name: 'platform',
                value: 'Ghana Recipes'
              }
            ]
          },
          channels: ['card', 'mobile_money', 'bank'],
          callback_url: `${process.env.CLIENT_URL}/payment/callback`
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.data;
    } catch (error) {
      logger.error(`Payment initialization error: ${error.message}`);
      throw new Error('Payment initialization failed');
    }
  }
  
  // Verify payment
  async verifyPayment(reference) {
    try {
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`
          }
        }
      );
      
      return response.data.data;
    } catch (error) {
      logger.error(`Payment verification error: ${error.message}`);
      throw new Error('Payment verification failed');
    }
  }
  
  // Create subscription plan
  async createSubscriptionPlan(name, amount, interval) {
    try {
      const response = await axios.post(
        `${this.paystackBaseUrl}/plan`,
        {
          name,
          amount: amount * 100, // Convert to pesewas
          interval, // 'monthly' or 'annually'
          currency: 'GHS'
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.data;
    } catch (error) {
      logger.error(`Create subscription plan error: ${error.message}`);
      throw new Error('Failed to create subscription plan');
    }
  }
  
  // Subscribe user to plan
  async subscribeUser(userId, planCode) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get or create Paystack customer
      const customer = await this.getOrCreateCustomer(user);
      
      // Create subscription
      const response = await axios.post(
        `${this.paystackBaseUrl}/subscription`,
        {
          customer: customer.customer_code,
          plan: planCode
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const subscription = response.data.data;
      
      // Update user subscription status
      user.subscription = {
        status: 'premium',
        plan: subscription.plan.interval,
        startDate: new Date(subscription.createdAt),
        endDate: new Date(subscription.next_payment_date),
        paymentMethod: 'paystack',
        autoRenew: true
      };
      
      await user.save();
      
      // Create subscription record
      await Subscription.create({
        user: userId,
        planId: planCode,
        subscriptionCode: subscription.subscription_code,
        status: 'active',
        amount: subscription.plan.amount / 100,
        currency: subscription.plan.currency,
        startDate: new Date(subscription.createdAt),
        nextPaymentDate: new Date(subscription.next_payment_date)
      });
      
      return subscription;
    } catch (error) {
      logger.error(`Subscribe user error: ${error.message}`);
      throw new Error('Subscription failed');
    }
  }
  
  // Get or create Paystack customer
  async getOrCreateCustomer(user) {
    try {
      // Try to get existing customer
      const getResponse = await axios.get(
        `${this.paystackBaseUrl}/customer/${user.email}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`
          }
        }
      );
      
      if (getResponse.data.status) {
        return getResponse.data.data;
      }
    } catch (error) {
      // Customer doesn't exist, create new one
      const createResponse = await axios.post(
        `${this.paystackBaseUrl}/customer`,
        {
          email: user.email,
          first_name: user.name.split(' ')[0],
          last_name: user.name.split(' ')[1] || '',
          phone: user.phone
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return createResponse.data.data;
    }
  }
  
  // Cancel subscription
  async cancelSubscription(userId) {
    try {
      const subscription = await Subscription.findOne({
        user: userId,
        status: 'active'
      });
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }
      
      // Cancel on Paystack
      const response = await axios.post(
        `${this.paystackBaseUrl}/subscription/disable`,
        {
          code: subscription.subscriptionCode,
          token: subscription.emailToken
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Update subscription status
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      await subscription.save();
      
      // Update user subscription status
      const user = await User.findById(userId);
      user.subscription.status = 'cancelled';
      user.subscription.autoRenew = false;
      await user.save();
      
      return response.data;
    } catch (error) {
      logger.error(`Cancel subscription error: ${error.message}`);
      throw new Error('Failed to cancel subscription');
    }
  }
  
  // Verify webhook signature
  verifyWebhook(body, signature) {
    const hash = crypto
      .createHmac('sha512', this.paystackSecretKey)
      .update(JSON.stringify(body))
      .digest('hex');
    
    return hash === signature;
  }
  
  // Process webhook
  async processWebhook(event, data) {
    try {
      switch (event) {
        case 'charge.success':
          await this.handleChargeSuccess(data);
          break;
        case 'subscription.create':
          await this.handleSubscriptionCreate(data);
          break;
        case 'subscription.disable':
          await this.handleSubscriptionDisable(data);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(data);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      logger.error(`Process webhook error: ${error.message}`);
      throw error;
    }
  }
  
  // Handle successful charge
  async handleChargeSuccess(data) {
    const { reference, customer, amount, metadata } = data;
    
    // Log transaction
    logger.info(`Payment successful: ${reference}, Amount: ${amount / 100} GHS`);
    
    // Update user if subscription payment
    if (metadata && metadata.subscription) {
      const user = await User.findOne({ email: customer.email });
      if (user) {
        user.subscription.status = 'premium';
        await user.save();
      }
    }
  }
  
  // Handle subscription creation
  async handleSubscriptionCreate(data) {
    const { customer, plan, subscription_code } = data;
    
    const user = await User.findOne({ email: customer.email });
    if (user) {
      user.subscription = {
        status: 'premium',
        plan: plan.interval,
        startDate: new Date(),
        endDate: new Date(data.next_payment_date),
        paymentMethod: 'paystack',
        autoRenew: true
      };
      await user.save();
    }
  }
  
  // Handle subscription disable
  async handleSubscriptionDisable(data) {
    const subscription = await Subscription.findOne({
      subscriptionCode: data.subscription_code
    });
    
    if (subscription) {
      subscription.status = 'cancelled';
      await subscription.save();
      
      const user = await User.findById(subscription.user);
      if (user) {
        user.subscription.status = 'free';
        user.subscription.autoRenew = false;
        await user.save();
      }
    }
  }
  
  // Handle payment failure
  async handlePaymentFailed(data) {
    const { customer, subscription } = data;
    
    logger.error(`Payment failed for customer: ${customer.email}`);
    
    // Send notification to user
    // You can implement email notification here
  }
}

module.exports = new PaymentService();