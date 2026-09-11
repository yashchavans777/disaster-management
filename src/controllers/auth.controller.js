const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user');
const apiResponse = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'disaster_management_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DB_CONNECTION_ERROR_MESSAGE =
  'Database is not connected. Please ensure MongoDB is running or configure MONGODB_URI (e.g. MongoDB Atlas) in your .env file.';

/**
 * Helper to generate a signed JWT token containing user metadata.
 * @param {Object} user - User document
 * @returns {string} Signed JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Format safe user object for response output (stripping password)
 * @param {Object} user 
 * @returns {Object} Safe user object
 */
const formatSafeUser = (user) => ({
  id: user._id ? user._id.toString() : user.id,
  userId: user._id ? user._id.toString() : user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || null,
  createdAt: user.createdAt,
});

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'operator', phone } = req.body;

    // Fast-fail if MongoDB is not connected
    if (mongoose.connection.readyState !== 1) {
      return apiResponse.error(res, 503, DB_CONNECTION_ERROR_MESSAGE);
    }

    // Validate required fields
    if (!name || !email || !password) {
      return apiResponse.error(
        res,
        400,
        'Name, email, and password are required fields.'
      );
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();

    if (trimmedName.length < 2) {
      return apiResponse.error(
        res,
        400,
        'Name must be at least 2 characters long.'
      );
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return apiResponse.error(
        res,
        400,
        'Please provide a valid email address.'
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return apiResponse.error(
        res,
        400,
        'Password must be at least 6 characters long.'
      );
    }

    const validRoles = ['admin', 'driver', 'manager', 'operator'];
    const userRole = validRoles.includes(role) ? role : 'operator';

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return apiResponse.error(
        res,
        409,
        'An account with this email already exists.'
      );
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    const newUser = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
      phone: phone ? phone.trim() : undefined,
    });

    const token = generateToken(newUser);
    const safeUser = formatSafeUser(newUser);

    // Set HttpOnly cookie for web security
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return apiResponse.success(res, 201, 'User registered successfully', {
      user: safeUser,
      token,
    });
  } catch (err) {
    if (
      err.name === 'MongooseError' ||
      err.message.includes('buffering timed out') ||
      err.message.includes('ECONNREFUSED')
    ) {
      return apiResponse.error(res, 503, DB_CONNECTION_ERROR_MESSAGE);
    }
    return apiResponse.error(
      res,
      500,
      `Registration failed: ${err.message}`
    );
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim();

    // 1. Validate input fields
    if (!identifier || !password) {
      return apiResponse.error(
        res,
        400,
        'Please provide both email (or username) and password.'
      );
    }

    const normalizedEmail = identifier.toLowerCase();

    // Validate email format if input looks like an email or is expected as email
    if (identifier.includes('@') && !EMAIL_REGEX.test(normalizedEmail)) {
      return apiResponse.error(
        res,
        400,
        'Please provide a valid email format.'
      );
    }

    // 2. Fast-fail if MongoDB is not connected
    if (mongoose.connection.readyState !== 1) {
      return apiResponse.error(res, 503, DB_CONNECTION_ERROR_MESSAGE);
    }

    // 3. Query database for existing user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return apiResponse.error(res, 401, 'Invalid email or password.');
    }

    // 4. Securely verify password against stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return apiResponse.error(res, 401, 'Invalid email or password.');
    }

    // 5. Generate JWT token with user metadata
    const token = generateToken(user);
    const safeUser = formatSafeUser(user);

    // 6. Optionally set HttpOnly cookie and return JSON payload
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return apiResponse.success(res, 200, 'Login successful', {
      user: safeUser,
      token,
    });
  } catch (err) {
    if (
      err.name === 'MongooseError' ||
      err.message.includes('buffering timed out') ||
      err.message.includes('ECONNREFUSED')
    ) {
      return apiResponse.error(res, 503, DB_CONNECTION_ERROR_MESSAGE);
    }
    return apiResponse.error(
      res,
      500,
      `Login failed: ${err.message}`
    );
  }
};

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return apiResponse.error(res, 401, 'Invalid user session.');
    }

    if (mongoose.connection.readyState !== 1) {
      return apiResponse.error(res, 503, DB_CONNECTION_ERROR_MESSAGE);
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return apiResponse.error(res, 404, 'User not found.');
    }

    return apiResponse.success(res, 200, 'User profile retrieved', {
      user: formatSafeUser(user),
    });
  } catch (err) {
    if (
      err.name === 'MongooseError' ||
      err.message.includes('buffering timed out') ||
      err.message.includes('ECONNREFUSED')
    ) {
      return apiResponse.error(res, 503, DB_CONNECTION_ERROR_MESSAGE);
    }
    return apiResponse.error(
      res,
      500,
      `Failed to retrieve user: ${err.message}`
    );
  }
};

/**
 * Auth health-check status
 * GET /api/auth/status
 */
const authStatus = (req, res) => {
  return apiResponse.success(res, 200, 'Auth service is operational', {
    authenticated: false,
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      getMe: 'GET /api/auth/me (Bearer Token required)',
    },
  });
};

module.exports = {
  EMAIL_REGEX,
  generateToken,
  formatSafeUser,
  register,
  login,
  getMe,
  authStatus,
};

