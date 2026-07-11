const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' }, // Home, Work, Other
  flatNo: String,
  society: String,
  area: String,
  city: { type: String, default: 'Pune' },
  pincode: String,
  latitude: Number,
  longitude: Number,
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  addresses: [addressSchema],
  role: {
    type: String,
    enum: ['customer'],
    default: 'customer'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notificationSettings: {
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true }
  },
  language: {
    type: String,
    default: 'en' // en, hi, mr
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
