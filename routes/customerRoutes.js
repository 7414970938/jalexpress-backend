const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const User = require('../models/User');
const Owner = require('../models/Owner');

router.use(protect, restrictTo('customer'));

// @route   GET /api/customer/me
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/customer/profile
router.put('/profile', async (req, res) => {
  try {
    const { name, email, language } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { ...(name && { name }), ...(email && { email }), ...(language && { language }) },
      { new: true }
    );
    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/customer/address
// @desc    Add a delivery address
router.post('/address', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses.push(req.body);
    await user.save();
    res.json({ success: true, message: 'Address added', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/customer/suppliers
// @desc    Browse/search nearby suppliers, optional search + service filter
// @query   ?search=&serviceType=&city=
router.get('/suppliers', async (req, res) => {
  try {
    const { search, serviceType, city } = req.query;
    let filter = { isActive: true, verificationStatus: 'verified' };

    if (search) {
      filter.businessName = { $regex: search, $options: 'i' };
    }
    if (serviceType) {
      filter.servicesOffered = serviceType;
    }
    if (city) {
      filter['serviceArea.city'] = city;
    }

    const suppliers = await Owner.find(filter)
      .select('businessName profilePhoto rating serviceArea servicesOffered priceList badges about')
      .sort({ 'rating.average': -1 });

    res.json({ success: true, count: suppliers.length, suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/customer/suppliers/:ownerId
// @desc    Get single supplier full profile (for supplier detail screen)
router.get('/suppliers/:ownerId', async (req, res) => {
  try {
    const supplier = await Owner.findById(req.params.ownerId)
      .select('-createdAt -updatedAt -__v');
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
