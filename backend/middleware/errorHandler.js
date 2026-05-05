// middleware/errorHandler.js
// ─────────────────────────────────────────────────────────────
// Global error handler — catches any error thrown in route handlers.
// Always returns a consistent JSON shape so the frontend can rely on it.
// ─────────────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Supabase / PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
    });
  }

  // JWT errors (shouldn't reach here normally, handled in auth.js)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }

  // Default
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
