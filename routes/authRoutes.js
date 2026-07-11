const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp');
const User = require('../models/User');
const Owner = require('../models/Owner');

// Generate 4-digit OTP
const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

// Sign JWT token
const signToken = (id, role, phone) => {
  return jwt.sign({ id, role, phone }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @route   POST /api/auth/send-otp
// @desc    Send OTP to phone number (for both customer & owner)
// @body    { phone, role }
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, role } = req.body;

    if (!phone || !role) {
      return res.status(400).json({ success: false, message: 'Phone number and role are required' });
    }
    if (!['customer', 'owner'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    // Remove any previous unused OTPs for this phone+role
    await Otp.deleteMany({ phone, role });

    await Otp.create({ phone, otp, role, expiresAt });

    // TODO: Integrate Twilio here to actually send SMS.
    // For now (free/dev mode), OTP is returned in response so you can test without SMS cost.
    // Once Twilio credentials are added in .env, uncomment the sendSms call below.

    console.log(`[DEV MODE] OTP for ${phone} (${role}): ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined // only exposed in dev
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error sending OTP' });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and log in / auto-register user
// @body    { phone, otp, role, name (required if new user) }
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp, role, name } = req.body;

    if (!phone || !otp || !role) {
      return res.status(400).json({ success: false, message: 'Phone, OTP and role are required' });
    }

    const otpRecord = await Otp.findOne({ phone, role }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request again.' });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request again.' });
    }

    // OTP valid - delete it so it can't be reused
    await Otp.deleteOne({ _id: otpRecord._id });

    const Model = role === 'customer' ? User : Owner;
    let account = await Model.findOne({ phone });
    let isNewAccount = false;

    if (!account) {
      isNewAccount = true;
      if (role === 'customer') {
        account = await User.create({ phone, name: name || 'New Customer', isVerified: true });
      } else {
        account = await Owner.create({ phone, ownerName: name || 'New Owner', businessName: name ? `${name}'s Tankers` : 'New Tanker Service' });
      }
    }

    const token = signToken(account._id, role, phone);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      isNewAccount,
      token,
      user: account
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
});

module.exports = router;
