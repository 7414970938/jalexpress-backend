const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: String,
  tankerCapacity: Number, // in liters
  vehicleType: String, // e.g. Tata 407, Ashok Leyland
  registrationDocUrl: String
});

const ownerSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    trim: true
  }, // e.g. "AquaFast Tankers", "Sharma Tankers"
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
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
  serviceArea: {
    city: { type: String, default: 'Pune' },
    areas: [String], // e.g. ['Wakad', 'Hinjewadi', 'Baner']
    latitude: Number,
    longitude: Number
  },
  servicesOffered: [{
    type: String,
    enum: ['Drinking Water', 'Borewell Water', 'Construction Water']
  }],
  vehicles: [vehicleSchema],
  priceList: [{
    serviceType: {
      type: String,
      enum: ['Drinking Water', 'Borewell Water', 'Construction Water']
    },
    capacity: Number, // 3000L, 5000L etc
    price: Number,
    estimatedDeliveryMins: { type: Number, default: 45 }
  }],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  badges: {
    verifiedWater: { type: Boolean, default: false },
    trustedSupplier: { type: Boolean, default: false },
    fastDelivery: { type: Boolean, default: false }
  },
  about: String,
  isOnline: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  earnings: {
    total: { type: Number, default: 0 },
    today: { type: Number, default: 0 }
  },
  stats: {
    totalOrders: { type: Number, default: 0 },
    totalDeliveries: { type: Number, default: 0 },
    onlineHours: { type: Number, default: 0 } // in minutes, for today
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Owner', ownerSchema);
