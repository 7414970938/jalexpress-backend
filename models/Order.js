const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  }, // e.g. JE-20260710-0001
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  serviceType: {
    type: String,
    enum: ['Drinking Water', 'Borewell Water', 'Construction Water'],
    required: true
  },
  tankerSize: {
    type: Number, // in liters e.g. 3000, 5000
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  deliveryAddress: {
    flatNo: String,
    society: String,
    area: String,
    city: String,
    pincode: String,
    latitude: Number,
    longitude: Number
  },
  contactNumber: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['whatsapp_qr', 'razorpay', 'cod'],
    default: 'whatsapp_qr'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'requested', 'paid', 'failed'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['booked', 'accepted', 'rejected', 'in_transit', 'delivered', 'cancelled'],
    default: 'booked'
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now }
  }],
  estimatedDeliveryTime: Date,
  deliveredAt: Date,
  rating: {
    stars: { type: Number, min: 1, max: 5 },
    review: String
  },
  isReorder: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Auto-generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `JE-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
