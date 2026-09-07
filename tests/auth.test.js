const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect, authorizeRoles } = require('../src/middlewares/auth.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'disaster_management_jwt_secret_key_2026';

const createMockRes = () => {
  const res = {
    statusCode: null,
    body: null,
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
  console.log('1. Testing Password Hashing & Comparison...');
  const rawPassword = 'SecurePassword123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);
  
  assert(hash !== rawPassword, 'Hash should not match raw password');
  assert(await bcrypt.compare(rawPassword, hash), 'Correct password must compare true');
  assert(!(await bcrypt.compare('WrongPassword', hash)), 'Wrong password must compare false');
  console.log('   ✓ Password hashing & comparison verified.');

  // Test 2: JWT generation and verification
  console.log('2. Testing JWT Signing & Verification...');
  const userPayload = {
    id: 'user_12345',
    email: 'operator@disaster.org',
    name: 'Chief Operator',
    role: 'operator',
  };
  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, JWT_SECRET);

  assert.strictEqual(decoded.id, userPayload.id);
  assert.strictEqual(decoded.email, userPayload.email);
  assert.strictEqual(decoded.role, userPayload.role);
  console.log('   ✓ JWT signing & payload verification verified.');

  // Test 3: Protect Middleware with valid token
  console.log('3. Testing Protect Middleware with valid Bearer token...');
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
  assert.strictEqual(mockReqValid.user.id, userPayload.id);
  console.log('   ✓ Protect middleware accepts valid Bearer tokens.');

  // Test 4: Protect Middleware with missing token
  console.log('4. Testing Protect Middleware with missing token...');
  const mockReqMissing = { headers: {} };
  const mockResMissing = createMockRes();

  protect(mockReqMissing, mockResMissing, () => {});
  assert.strictEqual(mockResMissing.statusCode, 401, 'Should return 401 when token is missing');
  assert.strictEqual(mockResMissing.body.success, false);
  console.log('   ✓ Protect middleware rejects missing tokens with 401.');

  // Test 5: Role Authorization Middleware
  console.log('5. Testing Role Authorization Middleware...');
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

  console.log('\n--- ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY (5/5) ---');
}

runAuthTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
