-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Adds admin support and onboarding document storage
-- ============================================================

-- Add admin role to users table check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('buyer', 'manufacturer', 'admin'));

-- Add company_name to user_manufacturers if not exists
ALTER TABLE user_manufacturers ADD COLUMN IF NOT EXISTS company_name TEXT;

-- ─────────────────────────────────────────────────────────────
-- ONBOARDING APPLICATIONS
-- Stores the full manufacturer onboarding submission
-- status: 'pending' | 'under_review' | 'approved' | 'rejected'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_applications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  company_name          TEXT NOT NULL,
  full_name             TEXT NOT NULL,
  phone                 TEXT,
  gstin                 TEXT,
  msme_number           TEXT,
  pan_number            TEXT,
  company_address       TEXT,
  city                  TEXT,
  state                 TEXT,
  pincode               TEXT,
  website               TEXT,
  description           TEXT,
  component_categories  TEXT[],          -- array of selected categories
  -- Document URLs (Cloudinary or base64 references)
  gst_doc_url           TEXT,
  msme_doc_url          TEXT,
  pan_doc_url           TEXT,
  coi_doc_url           TEXT,            -- Certificate of Incorporation
  factory_doc_url       TEXT,
  -- NDA
  nda_signed            BOOLEAN DEFAULT FALSE,
  nda_signed_at         TIMESTAMPTZ,
  signer_name           TEXT,
  signer_role           TEXT,
  -- Status
  status                TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','under_review','approved','rejected')),
  admin_notes           TEXT,
  reviewed_by           UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  -- Timestamps
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status  ON onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_email   ON onboarding_applications(email);

-- ─────────────────────────────────────────────────────────────
-- ADMIN USERS
-- Insert your admin account here (change email/password_hash)
-- Generate hash: node -e "require('bcryptjs').hash('YourAdminPass1',12).then(console.log)"
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO users (email, password_hash, full_name, role, is_verified)
-- VALUES ('admin@bharatmodules.com', '<bcrypt_hash_here>', 'Admin', 'admin', true)
-- ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- MANUFACTURER PENDING PAYMENTS
-- Admin-assigned pending amounts visible in manufacturer portal
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manufacturer_pending_payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_email TEXT NOT NULL,
  manufacturer_name  TEXT NOT NULL,
  amount             NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  description        TEXT NOT NULL,
  added_by           UUID REFERENCES users(id),   -- admin user id
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_email ON manufacturer_pending_payments(manufacturer_email);

-- ─────────────────────────────────────────────────────────────
-- EARLY ACCESS REGISTRATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS early_access_registrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role            TEXT NOT NULL CHECK (role IN ('buyer', 'manufacturer')),
  full_name       TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  work_email      TEXT NOT NULL,
  mobile          TEXT NOT NULL,
  city            TEXT,
  industry_sector TEXT,
  queries         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_early_access_email ON early_access_registrations(work_email);
CREATE INDEX IF NOT EXISTS idx_early_access_role  ON early_access_registrations(role);
