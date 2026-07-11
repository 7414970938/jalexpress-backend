const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');
const Owner = require('../models/Owner');

router.use(protect);

// @route   POST /api/orders
// @desc    Customer books a tanker
// @body    { owner, serviceType, tankerSize, price, deliveryAddress, contactNumber, paymentMethod }
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customers can book tankers' });
    }

    const { owner, serviceType, tankerSize, price, deliveryAddress, contactNumber, paymentMethod } = req.body;

    if (!owner || !serviceType || !tankerSize || !price || !deliveryAddress || !contactNumber) {
      return res.status(400).json({ success: false, message: 'Missing required booking details' });
    }

    const ownerDoc = await Owner.findById(owner);
    if (!ownerDoc) return res.status(404).json({ success: false, message: 'Selected supplier not found' });

    // Find matching estimated delivery time from owner's price list, default 45 mins
    const matched = ownerDoc.priceList.find(p => p.serviceType === serviceType && p.capacity === tankerSize);
    const estMins = matched ? matched.estimatedDeliveryMins : 45;

    const order = await Order.create({
      customer: req.user.id,
      owner,
      serviceType,
      tankerSize,
      price,
      deliveryAddress,
      contactNumber,
      paymentMethod: paymentMethod || 'whatsapp_qr',
      status: 'booked',
      statusHistory: [{ status: 'booked' }],
      estimatedDeliveryTime: new Date(Date.now() + estMins * 60 * 1000)
    });

    // NOTE: This is where a WhatsApp message with payment QR / request would be triggered
    // to the customer's contactNumber, once WhatsApp Business API is integrated.
    // For now this is a manual step handled outside the app.

    res.status(201).json({ success: true, message: 'Tanker booked successfully', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error creating booking' });
  }
});

// @route   GET /api/orders/my
// @desc    Get logged-in customer's orders (order history / my orders screen)
// @query   ?status=ongoing|completed|cancelled|all
router.get('/my', async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }
    const { status } = req.query;
    let filter = { customer: req.user.id };

    if (status === 'ongoing') filter.status = { $in: ['booked', 'accepted', 'in_transit'] };
    else if (status === 'completed') filter.status = 'delivered';
    else if (status === 'cancelled') filter.status = 'cancelled';

    const orders = await Order.find(filter)
      .populate('owner', 'businessName profilePhoto rating')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/orders/:orderId
// @desc    Get single order detail (for tracking screen)
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('owner', 'businessName profilePhoto rating serviceArea')
      .populate('customer', 'name phone');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/orders/:orderId/cancel
// @desc    Customer cancels an order
router.put('/:orderId/cancel', async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, customer: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel an order that is already ${order.status}` });
    }
    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled' });
    await order.save();
    res.json({ success: true, message: 'Order cancelled', order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/orders/:orderId/reorder
// @desc    Reorder same tanker/service from a past order
router.post('/:orderId/reorder', async (req, res) => {
  try {
    const oldOrder = await Order.findOne({ _id: req.params.orderId, customer: req.user.id });
    if (!oldOrder) return res.status(404).json({ success: false, message: 'Order not found' });

    const newOrder = await Order.create({
      customer: req.user.id,
      owner: oldOrder.owner,
      serviceType: oldOrder.serviceType,
      tankerSize: oldOrder.tankerSize,
      price: oldOrder.price,
      deliveryAddress: oldOrder.deliveryAddress,
      contactNumber: oldOrder.contactNumber,
      paymentMethod: oldOrder.paymentMethod,
      status: 'booked',
      statusHistory: [{ status: 'booked' }],
      isReorder: true,
      estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000)
    });

    res.status(201).json({ success: true, message: 'Reordered successfully', order: newOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/orders/:orderId/rate
// @desc    Customer rates a delivered order
// @body    { stars, review }
router.post('/:orderId/rate', async (req, res) => {
  try {
    const { stars, review } = req.body;
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, message: 'Stars must be between 1 and 5' });
    }

    const order = await Order.findOne({ _id: req.params.orderId, customer: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only rate delivered orders' });
    }

    order.rating = { stars, review };
    await order.save();

    // Update owner's average rating
    const owner = await Owner.findById(order.owner);
    const newCount = owner.rating.count + 1;
    const newAvg = ((owner.rating.average * owner.rating.count) + stars) / newCount;
    owner.rating.average = Number(newAvg.toFixed(1));
    owner.rating.count = newCount;
    await owner.save();

    res.json({ success: true, message: 'Rating submitted', order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
