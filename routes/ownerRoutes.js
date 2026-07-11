const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const Owner = require('../models/Owner');
const Order = require('../models/Order');

// All routes below require login as 'owner'
router.use(protect, restrictTo('owner'));

// @route   GET /api/owner/me
// @desc    Get logged-in owner's profile
router.get('/me', async (req, res) => {
  try {
    const owner = await Owner.findById(req.user.id);
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });
    res.json({ success: true, owner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/owner/profile
// @desc    Update owner profile (name, business name, services, vehicles)
router.put('/profile', async (req, res) => {
  try {
    const { ownerName, businessName, email, servicesOffered, vehicles, serviceArea, about } = req.body;

    const owner = await Owner.findById(req.user.id);
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    if (ownerName) owner.ownerName = ownerName;
    if (businessName) owner.businessName = businessName;
    if (email) owner.email = email;
    if (servicesOffered) owner.servicesOffered = servicesOffered;
    if (vehicles) owner.vehicles = vehicles;
    if (serviceArea) owner.serviceArea = { ...owner.serviceArea.toObject(), ...serviceArea };
    if (about) owner.about = about;

    await owner.save();
    res.json({ success: true, message: 'Profile updated', owner });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

// @route   PUT /api/owner/price-list
// @desc    Update price list for services
// @body    { priceList: [{ serviceType, capacity, price, estimatedDeliveryMins }] }
router.put('/price-list', async (req, res) => {
  try {
    const { priceList } = req.body;
    const owner = await Owner.findByIdAndUpdate(req.user.id, { priceList }, { new: true });
    res.json({ success: true, message: 'Price list updated', priceList: owner.priceList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/owner/online-status
// @desc    Toggle online/offline (accepting new orders)
router.put('/online-status', async (req, res) => {
  try {
    const { isOnline } = req.body;
    const owner = await Owner.findByIdAndUpdate(req.user.id, { isOnline }, { new: true });
    res.json({ success: true, isOnline: owner.isOnline });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/owner/dashboard
// @desc    Dashboard summary - earnings, orders, rating, deliveries
router.get('/dashboard', async (req, res) => {
  try {
    const owner = await Owner.findById(req.user.id);
    const totalOrders = await Order.countDocuments({ owner: req.user.id });
    const completedOrders = await Order.countDocuments({ owner: req.user.id, status: 'delivered' });

    res.json({
      success: true,
      dashboard: {
        earned: owner.earnings.total,
        todayEarning: owner.earnings.today,
        orders: totalOrders,
        deliveries: completedOrders,
        rating: owner.rating.average,
        onlineHours: owner.stats.onlineHours
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/owner/orders
// @desc    Get owner's orders, filterable by status
// @query   ?status=ongoing|completed|cancelled|all
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let filter = { owner: req.user.id };

    if (status === 'ongoing') filter.status = { $in: ['booked', 'accepted', 'in_transit'] };
    else if (status === 'completed') filter.status = 'delivered';
    else if (status === 'cancelled') filter.status = 'cancelled';

    const orders = await Order.find(filter).populate('customer', 'name phone').sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/owner/orders/:orderId/status
// @desc    Owner accepts/rejects/updates order status
// @body    { status: 'accepted' | 'rejected' | 'in_transit' | 'delivered' }
router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['accepted', 'rejected', 'in_transit', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.orderId, owner: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status;
    order.statusHistory.push({ status });
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      // Update owner earnings & stats
      await Owner.findByIdAndUpdate(req.user.id, {
        $inc: {
          'earnings.total': order.price,
          'earnings.today': order.price,
          'stats.totalOrders': 1,
          'stats.totalDeliveries': 1
        }
      });
    }
    await order.save();

    res.json({ success: true, message: `Order ${status}`, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/owner/earnings
// @desc    Earnings summary with period filter
// @query   ?period=today|yesterday|last7days|lastmonth
router.get('/earnings', async (req, res) => {
  try {
    const { period } = req.query;
    let startDate = new Date();

    if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0,0,0,0);
    } else if (period === 'last7days') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'lastmonth') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate.setHours(0,0,0,0); // today
    }

    const orders = await Order.find({
      owner: req.user.id,
      status: 'delivered',
      deliveredAt: { $gte: startDate }
    });

    const totalEarning = orders.reduce((sum, o) => sum + o.price, 0);
    const avgPerTrip = orders.length ? (totalEarning / orders.length).toFixed(0) : 0;

    res.json({
      success: true,
      period: period || 'today',
      totalEarning,
      tripsCompleted: orders.length,
      avgPerTrip
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
