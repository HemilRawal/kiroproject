-- ============================================================
-- BHARAT MODULES — DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. USERS
--    Stores both buyers and manufacturers.
--    role: 'buyer' | 'manufacturer' | 'admin'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT,                          -- NULL if Google OAuth only
  full_name       TEXT NOT NULL,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'buyer'
                    CHECK (role IN ('buyer', 'manufacturer', 'admin')),
  google_id       TEXT UNIQUE,                   -- for Google OAuth
  is_verified     BOOLEAN DEFAULT FALSE,         -- email verified
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. MANUFACTURERS
--    Extended profile for users with role = 'manufacturer'
--    verification_status: 'pending' | 'under_review' | 'approved' | 'rejected'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manufacturers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name          TEXT NOT NULL,
  gstin                 TEXT UNIQUE,             -- GST Identification Number
  msme_number           TEXT,
  pan_number            TEXT,
  company_address       TEXT,
  city                  TEXT,
  state                 TEXT,
  pincode               TEXT,
  website               TEXT,
  description           TEXT,
  verification_status   TEXT DEFAULT 'pending'
                          CHECK (verification_status IN ('pending','under_review','approved','rejected')),
  rejection_reason      TEXT,
  -- Document URLs (stored in Cloudinary)
  gst_doc_url           TEXT,
  msme_doc_url          TEXT,
  pan_doc_url           TEXT,
  manufacturing_cert_url TEXT,
  -- NDA
  nda_signed            BOOLEAN DEFAULT FALSE,
  nda_signed_at         TIMESTAMPTZ,
  -- Metadata
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. CATEGORIES
--    Product categories (e.g., Solar Modules, Inverters)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  icon_svg    TEXT,                              -- inline SVG string
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 4. PRODUCTS
--    Listed by manufacturers after approval
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_id   UUID NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES categories(id),
  name              TEXT NOT NULL,
  sku               TEXT UNIQUE,
  description       TEXT,
  specifications    JSONB,                       -- flexible key-value specs
  images            TEXT[],                      -- array of Cloudinary URLs
  is_active         BOOLEAN DEFAULT TRUE,
  is_verified       BOOLEAN DEFAULT FALSE,       -- platform-verified product
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5. RFQ (Request for Quotation)
--    Created by buyers. One RFQ can have multiple line items.
--    status: 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected' | 'expired'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfqs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_number      TEXT UNIQUE NOT NULL,          -- human-readable e.g. RFQ-2024-00042
  buyer_id        UUID NOT NULL REFERENCES users(id),
  status          TEXT DEFAULT 'submitted'
                    CHECK (status IN ('submitted','under_review','quoted','accepted','rejected','expired')),
  notes           TEXT,                          -- buyer's additional notes
  delivery_state  TEXT,
  delivery_pincode TEXT,
  required_by     DATE,                          -- delivery deadline
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. RFQ ITEMS
--    Each line item in an RFQ (one product per row)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id      UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  product_name TEXT NOT NULL,                    -- snapshot at time of RFQ
  sku         TEXT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit        TEXT DEFAULT 'units',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. RFQ QUOTES
--    Manufacturers respond to RFQs with quotes
--    status: 'pending' | 'submitted' | 'accepted' | 'rejected'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_quotes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id            UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  manufacturer_id   UUID NOT NULL REFERENCES manufacturers(id),
  rfq_item_id       UUID REFERENCES rfq_items(id),
  unit_price        NUMERIC(12, 2),
  total_price       NUMERIC(12, 2),
  currency          TEXT DEFAULT 'INR',
  lead_time_days    INTEGER,
  validity_days     INTEGER DEFAULT 30,
  notes             TEXT,
  status            TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending','submitted','accepted','rejected')),
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. ORDERS
--    Created when a buyer accepts a quote
--    status: 'confirmed' | 'manufacturing' | 'dispatched' | 'delivered' | 'cancelled'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number      TEXT UNIQUE NOT NULL,        -- e.g. ORD-2024-00018
  buyer_id          UUID NOT NULL REFERENCES users(id),
  manufacturer_id   UUID NOT NULL REFERENCES manufacturers(id),
  rfq_id            UUID REFERENCES rfqs(id),
  rfq_quote_id      UUID REFERENCES rfq_quotes(id),
  status            TEXT DEFAULT 'confirmed'
                      CHECK (status IN ('confirmed','manufacturing','dispatched','delivered','cancelled')),
  total_amount      NUMERIC(12, 2),
  currency          TEXT DEFAULT 'INR',
  delivery_address  TEXT,
  tracking_number   TEXT,
  courier_name      TEXT,
  notes             TEXT,
  confirmed_at      TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 9. ORDER DOCUMENTS (compliance docs attached to orders)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  doc_type    TEXT,                              -- e.g. 'Test Certificate', 'Invoice'
  file_url    TEXT NOT NULL,
  file_size   TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 10. WISHLIST
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ─────────────────────────────────────────────────────────────
-- 11. CONTACT ENQUIRIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_enquiries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  company     TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  enquiry_type TEXT,                             -- 'buyer' | 'manufacturer' | 'general'
  status      TEXT DEFAULT 'new'
                CHECK (status IN ('new','in_progress','resolved')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES — speed up common queries
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id       ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_rfq_number     ON rfqs(rfq_number);
CREATE INDEX IF NOT EXISTS idx_rfqs_status         ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq_id    ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id     ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_user  ON manufacturers(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user      ON wishlists(user_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) — Supabase security layer
-- Buyers can only see their own RFQs/orders.
-- Manufacturers can only see their own data.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quotes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists          ENABLE ROW LEVEL SECURITY;

-- NOTE: We use service_role key in our backend which bypasses RLS.
-- RLS protects against direct client-side Supabase calls.
