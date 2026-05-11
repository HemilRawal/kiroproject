// server.js
// ─────────────────────────────────────────────────────────────
// Main entry point for the Bharat Modules API server.
//
// Security layers applied here:
//   1. helmet      — sets secure HTTP headers
//   2. cors        — only allows requests from your frontend URL
//   3. rate-limit  — blocks brute-force attacks
//   4. express.json with size limit — prevents large payload attacks
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── 1. SECURITY HEADERS (helmet) ────────────────────────────
// CSP disabled in development to allow Firebase, Recaptcha, Google Fonts, etc.
// Re-enable with proper directives before deploying to production.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── 2. CORS ──────────────────────────────────────────────────
// Only allow requests from your frontend domain
// Add any new frontend URLs here or in .env as ALLOWED_ORIGINS (comma-separated)
// Example .env entry: ALLOWED_ORIGINS=https://bharatmodules.com,https://www.bharatmodules.com
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://bharat-modules.vercel.app',
  'https://bharat-modules-git-pass-hemilrawals-projects.vercel.app',
  'https://bharat-modules-p5ixgzduv-hemilrawals-projects.vercel.app',
  'null',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: true,  // allow all origins during testing
  credentials: true,
}));

// ── 3. RATE LIMITING ─────────────────────────────────────────
// General limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for auth endpoints: 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use(generalLimiter);

// ── 4. BODY PARSING ──────────────────────────────────────────
// Limit request body to 10kb to prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── 5. STATIC FILES & HEALTH CHECK ──────────────────────────
// Serve all static files (HTML, CSS, JS, Images) from the parent directory
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Bharat Modules API is running.', timestamp: new Date() });
});

// Serve the login page at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'login-page.html'));
});

// ── 6. ROUTES ────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/rfq', require('./routes/rfq'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/manufacturers', require('./routes/manufacturers'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/early-access', require('./routes/earlyAccess'));

// ── 7. 404 HANDLER ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ── 8. GLOBAL ERROR HANDLER ──────────────────────────────────
app.use(errorHandler);

// ── 9. START SERVER ──────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n✅ Bharat Modules API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});
