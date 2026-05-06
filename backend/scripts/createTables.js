// scripts/createTables.js
// ─────────────────────────────────────────────────────────────
// Run this script ONCE to create the new auth tables in Supabase.
// Usage: node scripts/createTables.js
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const supabase = require('../config/db');

const createTables = async () => {
  console.log('Creating new auth tables...\n');

  // 1. user_buyers table
  console.log('1. Creating user_buyers table...');
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS user_buyers (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email           TEXT UNIQUE NOT NULL,
        password_hash   TEXT NOT NULL,
        full_name       TEXT NOT NULL,
        phone           TEXT,
        company_name    TEXT,
        email_verified  BOOLEAN DEFAULT FALSE,
        phone_verified  BOOLEAN DEFAULT FALSE,
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });
  if (e1) console.log('   Note:', e1.message);
  else console.log('   ✅ Done');

  // 2. user_manufacturers table
  console.log('2. Creating user_manufacturers table...');
  const { error: e2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS user_manufacturers (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email           TEXT UNIQUE NOT NULL,
        password_hash   TEXT NOT NULL,
        full_name       TEXT NOT NULL,
        phone           TEXT,
        company_name    TEXT,
        email_verified  BOOLEAN DEFAULT FALSE,
        phone_verified  BOOLEAN DEFAULT FALSE,
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });
  if (e2) console.log('   Note:', e2.message);
  else console.log('   ✅ Done');

  // 3. verification_otps table
  console.log('3. Creating verification_otps table...');
  const { error: e3 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS verification_otps (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        identifier  TEXT NOT NULL,
        otp_code    TEXT NOT NULL,
        otp_type    TEXT NOT NULL CHECK (otp_type IN ('email', 'phone')),
        user_role   TEXT NOT NULL CHECK (user_role IN ('buyer', 'manufacturer')),
        expires_at  TIMESTAMPTZ NOT NULL,
        used        BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });
  if (e3) console.log('   Note:', e3.message);
  else console.log('   ✅ Done');

  console.log('\n✅ All tables created (or already exist).');
  console.log('\n⚠️  If "exec_sql" RPC is not available, please run the SQL');
  console.log('   from models/schema.sql directly in the Supabase SQL Editor.');
  process.exit(0);
};

createTables().catch(err => {
  console.error('Error:', err.message);
  console.log('\n📋 Please run the following SQL directly in your Supabase SQL Editor:');
  console.log('   (Dashboard → SQL Editor → New Query)\n');
  console.log(`
CREATE TABLE IF NOT EXISTS user_buyers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  company_name    TEXT,
  email_verified  BOOLEAN DEFAULT FALSE,
  phone_verified  BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_manufacturers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  company_name    TEXT,
  email_verified  BOOLEAN DEFAULT FALSE,
  phone_verified  BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_otps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier  TEXT NOT NULL,
  otp_code    TEXT NOT NULL,
  otp_type    TEXT NOT NULL CHECK (otp_type IN ('email', 'phone')),
  user_role   TEXT NOT NULL CHECK (user_role IN ('buyer', 'manufacturer')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_identifier ON verification_otps(identifier, otp_type, user_role);
CREATE INDEX IF NOT EXISTS idx_user_buyers_email ON user_buyers(email);
CREATE INDEX IF NOT EXISTS idx_user_manufacturers_email ON user_manufacturers(email);
  `);
  process.exit(1);
});
