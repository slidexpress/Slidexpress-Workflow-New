const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../utils/email');
const { authenticate } = require('../middleware/auth');

// Login route - OPTIMIZED FOR SPEED
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // ⚡ FAST: Find user with only password field first (no populate)
    const userBasic = await User.findOne({ email }).select('password isActive isFirstLogin').lean();

    if (!userBasic) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!userBasic.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated' });
    }

    // ⚡ FAST: Verify password (this is the slowest part - bcrypt)
    const isMatch = await require('bcryptjs').compare(password, userBasic.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ⚡ Only fetch full user data AFTER password is verified
    const user = await User.findById(userBasic._id).populate('workspace').populate('teamLead', 'name email role');

    // Check if first login
    if (userBasic.isFirstLogin) {
      // DEVELOPMENT MODE: Skip OTP and allow direct password change
      // For production, uncomment the OTP code below and remove this section

      return res.json({
        isFirstLogin: true,
        requirePasswordChange: true,
        message: 'First time login. Please reset your password.',
        email: user.email,
        userId: user._id,
        // Temporary token for password change only
        tempToken: jwt.sign(
          { userId: user._id, email: user.email, purpose: 'password_reset' },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        )
      });

      /* PRODUCTION CODE - Uncomment this when email is configured:
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Save OTP to database
      await OTP.create({
        email: user.email,
        otp: otp,
        purpose: 'first_login'
      });

      // Send OTP email
      const emailResult = await sendOTPEmail(user.email, otp, 'first_login');

      if (!emailResult.success) {
        return res.status(500).json({
          message: 'Failed to send OTP email. Please verify email credentials on the server.',
          error: emailResult.error
        });
      }

      return res.json({
        isFirstLogin: true,
        message: 'First time login. OTP sent to your email. Please reset your password.',
        email: user.email
      });
      */
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        workspace: user.workspace,
        teamLead: user.teamLead,
        isFirstLogin: false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        workspace: req.user.workspace,
        teamLead: req.user.teamLead,
        isFirstLogin: req.user.isFirstLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Direct password change for first login (Development mode)
router.post('/change-password-direct', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide email, old password, and new password' });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid old password' });
    }

    // Update password and first login status
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    res.json({ message: 'Password changed successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
