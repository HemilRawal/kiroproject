// middleware/auth.js
// ─────────────────────────────────────────────────────────────
// JWT verification middleware.
// Attach this to any route that requires a logged-in user.
//
// How it works:
//   1. Client sends: Authorization: Bearer <token>
//   2. We verify the token with our JWT_SECRET
//   3. We attach the decoded user payload to req.user
//   4. If invalid/expired → 401 Unauthorized
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');

// Verify token and attach user to request
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

// Role-based access control
// Usage: router.get('/admin-only', protect, requireRole('admin'), handler)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
};

module.exports = { protect, requireRole };
