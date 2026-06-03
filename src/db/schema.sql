-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image         TEXT,
  role          TEXT NOT NULL DEFAULT 'admin',
  createdAt     INTEGER NOT NULL,
  updatedAt     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expiresAt   INTEGER NOT NULL,
  ipAddress   TEXT,
  userAgent   TEXT,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "account" (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,
  accessToken           TEXT,
  refreshToken          TEXT,
  accessTokenExpiresAt  INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope                 TEXT,
  idToken               TEXT,
  password              TEXT,
  createdAt             INTEGER NOT NULL,
  updatedAt             INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER NOT NULL,
  updatedAt  INTEGER NOT NULL
);

-- App tables
CREATE TABLE IF NOT EXISTS settings (
  id              TEXT PRIMARY KEY DEFAULT 'singleton',
  shopName        TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  defaultLaborRate REAL NOT NULL DEFAULT 95.0,
  defaultTaxRate   REAL NOT NULL DEFAULT 0.0,
  logoData        TEXT,
  logoPublicId    TEXT,
  brandColor      TEXT,
  updatedAt       INTEGER
);

CREATE TABLE IF NOT EXISTS customers (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT,
  phone     TEXT,
  address   TEXT,
  notes     TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS estimates (
  id          TEXT PRIMARY KEY,
  customerId  TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'draft',
  title       TEXT NOT NULL,
  vehicleInfo TEXT,
  notes       TEXT,
  taxRate     REAL NOT NULL DEFAULT 0.0,
  shareToken  TEXT UNIQUE,
  sentAt      INTEGER,
  approvedAt  INTEGER,
  declinedAt  INTEGER,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  estimateId  TEXT REFERENCES estimates(id) ON DELETE SET NULL,
  customerId  TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'draft',
  title       TEXT NOT NULL,
  vehicleInfo TEXT,
  notes       TEXT,
  taxRate     REAL NOT NULL DEFAULT 0.0,
  shareToken  TEXT UNIQUE,
  dueDate     INTEGER,
  sentAt      INTEGER,
  paidAt      INTEGER,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS line_items (
  id          TEXT PRIMARY KEY,
  estimateId  TEXT REFERENCES estimates(id) ON DELETE CASCADE,
  invoiceId   TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  sortOrder   INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  laborHours  REAL,
  laborRate   REAL,
  partNumber  TEXT,
  quantity    REAL,
  unitPrice   REAL,
  flatPrice   REAL,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL,
  CHECK ((estimateId IS NOT NULL AND invoiceId IS NULL) OR (estimateId IS NULL AND invoiceId IS NOT NULL))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customerId);
CREATE INDEX IF NOT EXISTS idx_estimates_token    ON estimates(shareToken);
CREATE INDEX IF NOT EXISTS idx_invoices_customer  ON invoices(customerId);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate  ON invoices(estimateId);
CREATE INDEX IF NOT EXISTS idx_invoices_token     ON invoices(shareToken);
CREATE INDEX IF NOT EXISTS idx_line_items_est     ON line_items(estimateId);
CREATE INDEX IF NOT EXISTS idx_line_items_inv     ON line_items(invoiceId);
CREATE INDEX IF NOT EXISTS idx_session_token      ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user       ON session(userId);
