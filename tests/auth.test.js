const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect, authorizeRoles } = require('../src/middlewares/auth.middleware');
const {
  EMAIL_REGEX,
  generateToken,
  formatSafeUser,
  login,
  register,
} = require('../src/controllers/auth.controller');
const User = require('../src/models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'disaster_management_jwt_secret_key_2026';

const createMockRes = () => {
  const res = {
    statusCode: null,
    body: null,
    cookies: {},
    cookie(name, val, options) {
      this.cookies[name] = { val, options };
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

async function runAuthTests() {
  console.log('--- Starting Authentication System Unit & Integration Tests ---');

  // Test 1: Password hashing and comparison
  console.log('1. Testing Password Hashing & Comparison with Bcrypt...');
  const rawPassword = 'SecurePassword123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);
  
  assert(hash !== rawPassword, 'Hash should not match raw password');
  assert(await bcrypt.compare(rawPassword, hash), 'Correct password must compare true');
  assert(!(await bcrypt.compare('WrongPassword', hash)), 'Wrong password must compare false');
  console.log('   ✓ Password hashing & comparison verified.');

  // Test 2: Email format regex verification
  console.log('2. Testing Email Regex Validation...');
  const validEmails = ['admin@disaster.org', 'operator.center@emergency.gov.in', 'user+test@domain.co'];
  const invalidEmails = ['invalid-email', 'missingatsign.com', '@nodomain.com', 'spaces in@email.com'];

  for (const email of validEmails) {
    assert(EMAIL_REGEX.test(email), `Email "${email}" should be valid`);
  }
  for (const email of invalidEmails) {
    assert(!EMAIL_REGEX.test(email), `Email "${email}" should be invalid`);
  }
  console.log('   ✓ Email validation regex successfully tested on valid & malformed inputs.');

  // Test 3: JWT generation and payload verification
  console.log('3. Testing JWT Signing & User Metadata Extraction...');
  const mockUser = {
    _id: '64f1a2b3c4d5e6f7a8b9c0d1',
    email: 'operator@disaster.org',
    name: 'Chief Operator',
    role: 'operator',
    createdAt: new Date(),
  };

  const token = generateToken(mockUser);
  const decoded = jwt.verify(token, JWT_SECRET);

  assert.strictEqual(decoded.id, mockUser._id);
  assert.strictEqual(decoded.userId, mockUser._id);
  assert.strictEqual(decoded.email, mockUser.email);
  assert.strictEqual(decoded.name, mockUser.name);
  assert.strictEqual(decoded.role, mockUser.role);

  const safeUser = formatSafeUser(mockUser);
  assert.strictEqual(safeUser.id, mockUser._id);
  assert.strictEqual(safeUser.password, undefined, 'Password must not be present in safeUser object');
  console.log('   ✓ JWT signing, claims verification, and safe user payload verified.');

  // Test 4: Protect Middleware with valid token
  console.log('4. Testing Protect Middleware with valid Bearer token...');
  let nextCalled = false;
  const mockReqValid = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  const mockResValid = createMockRes();

  protect(mockReqValid, mockResValid, () => {
    nextCalled = true;
  });

  assert(nextCalled, 'protect middleware should call next() on valid token');
  assert.strictEqual(mockReqValid.user.id, mockUser._id);
  console.log('   ✓ Protect middleware accepts valid Bearer tokens.');

  // Test 5: Protect Middleware with missing & expired token
  console.log('5. Testing Protect Middleware error handling...');
  const mockReqMissing = { headers: {} };
  const mockResMissing = createMockRes();

  protect(mockReqMissing, mockResMissing, () => {});
  assert.strictEqual(mockResMissing.statusCode, 401, 'Should return 401 when token is missing');
  assert.strictEqual(mockResMissing.body.success, false);

  const expiredToken = jwt.sign({ id: 'expired_user' }, JWT_SECRET, { expiresIn: '0s' });
  const mockReqExpired = { headers: { authorization: `Bearer ${expiredToken}` } };
  const mockResExpired = createMockRes();
  protect(mockReqExpired, mockResExpired, () => {});
  assert.strictEqual(mockResExpired.statusCode, 401, 'Should return 401 when token is expired');
  console.log('   ✓ Protect middleware rejects missing and expired tokens with 401.');

  // Test 6: Role Authorization Middleware
  console.log('6. Testing Role Authorization Middleware (RBAC)...');
  const driverOnlyMiddleware = authorizeRoles('driver');
  const operatorOrAdminMiddleware = authorizeRoles('operator', 'admin');

  let driverNextCalled = false;
  const mockResForbidden = createMockRes();
  driverOnlyMiddleware(mockReqValid, mockResForbidden, () => {
    driverNextCalled = true;
  });
  assert(!driverNextCalled, 'Operator should NOT be authorized for driver-only route');
  assert.strictEqual(mockResForbidden.statusCode, 403, 'Should return 403 Forbidden for unauthorized role');

  let operatorNextCalled = false;
  const mockResAllowed = createMockRes();
  operatorOrAdminMiddleware(mockReqValid, mockResAllowed, () => {
    operatorNextCalled = true;
  });
  assert(operatorNextCalled, 'Operator should be authorized for operator/admin route');
  console.log('   ✓ Role authorization middleware behaves correctly (403 for forbidden, next() for allowed).');

  // Test 7: Controller input validation for Login
  console.log('7. Testing Login Controller validation & 400 responses...');
  
  // Empty credentials
  const mockResEmpty = createMockRes();
  await login({ body: { email: '', password: '' } }, mockResEmpty);
  assert.strictEqual(mockResEmpty.statusCode, 400);
  assert.strictEqual(mockResEmpty.body.success, false);

  // Malformed email
  const mockResMalformed = createMockRes();
  await login({ body: { email: 'bad-email-format@', password: 'secretpassword' } }, mockResMalformed);
  assert.strictEqual(mockResMalformed.statusCode, 400);
  assert.strictEqual(mockResMalformed.body.success, false);
  console.log('   ✓ Login controller properly rejects empty and malformed requests with 400.');

  console.log('\n--- ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY (7/7) ---');
}

runAuthTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

