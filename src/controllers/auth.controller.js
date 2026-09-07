const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const apiResponse = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'disaster_management_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT token for a user.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'operator', phone } = req.body;

    if (!name || !email || !password) {
      return apiResponse.error(
        res,
        400,
        'Name, email, and password are required fields.'
      );
    }

    if (password.length < 6) {
      return apiResponse.error(
        res,
        400,
        'Password must be at least 6 characters long.'
      );
    }

    const validRoles = ['admin', 'driver', 'manager', 'operator'];
    const userRole = validRoles.includes(role) ? role : 'operator';

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return apiResponse.error(
        res,
        409,
        'An account with this email already exists.'
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
      phone: phone ? phone.trim() : undefined,
    });

    const token = generateToken(newUser);

    const safeUser = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      createdAt: newUser.createdAt,
    };

    return apiResponse.success(res, 201, 'User registered successfully', {
      user: safeUser,
      token,
    });
  } catch (err) {
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
    const { email, password } = req.body;

    if (!email || !password) {
      return apiResponse.error(
        res,
        400,
        'Please provide both email and password.'
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return apiResponse.error(res, 401, 'Invalid email or password.');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return apiResponse.error(res, 401, 'Invalid email or password.');
    }

    const token = generateToken(user);

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      createdAt: user.createdAt,
    };

    return apiResponse.success(res, 200, 'Login successful', {
      user: safeUser,
      token,
    });
  } catch (err) {
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
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return apiResponse.error(res, 404, 'User not found.');
    }

    return apiResponse.success(res, 200, 'User profile retrieved', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
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
  register,
  login,
  getMe,
  authStatus,
};
