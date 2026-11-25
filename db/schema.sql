-- Order lifecycle. The database rejects anything else, so a typo can never
-- silently hide an order from the staff board.
--   pending_payment  sent to Square's payment page, not paid yet (hidden from staff)
--   new              paid and verified with Square — appears on the staff board
--   preparing / ready / completed   staff progress
-- To add a status later: ALTER TYPE order_status ADD VALUE 'name'
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending_payment', 'new', 'preparing', 'ready', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  order_number TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  note TEXT,
  pickup_label TEXT,
  items JSONB NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  packing_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  payment_id TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  status order_status NOT NULL DEFAULT 'pending_payment',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convert databases created before order_status existed (status was TEXT,
-- default 'new'). Runs once, and is a no-op when the column is already the enum.
-- Default is now 'pending_payment' so a row inserted without an explicit
-- status can never appear on the staff board as if it were paid.
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'status') = 'text' THEN
    ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::order_status;
    ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending_payment';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_received_at_idx ON orders (received_at DESC);

-- Square hosted checkout: an order row is created as 'pending_payment' when
-- the customer is sent to Square's payment page, and only becomes 'new'
-- (visible on the staff board) once the server has verified with Square that
-- it was paid in full. square_order_id links the row to the Square order, and
-- checkout_token is an unguessable id used in the return URL so the "thanks"
-- page can look the order up without exposing it by order number.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS square_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_square_order_id_idx ON orders (square_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_token_idx ON orders (checkout_token);

-- Out-of-stock list. A row means "out" (it's deleted when back in stock).
-- item_key is either a whole product id ("monster") or one exact item —
-- products.js variantKey(): "productId::size::flavour" (flavour empty for
-- products without one), e.g. "monster::500ml::Mango Loco".
CREATE TABLE IF NOT EXISTS stock_overrides (
  item_key TEXT PRIMARY KEY,
  out_of_stock BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Before per-item stock the key column was product_id (whole products only).
-- Existing product ids stay valid keys, so it's a pure rename.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'stock_overrides' AND column_name = 'product_id') THEN
    ALTER TABLE stock_overrides RENAME COLUMN product_id TO item_key;
  END IF;
END $$;

-- Generic single-value settings store. Currently holds "ordering_mode"
-- (auto | open | closed) — a staff override on top of the scheduled
-- opening hours, for closing early, staying open late, etc.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Square payment link id, so an abandoned checkout's link can be switched off
-- before its order row is deleted (otherwise the customer could still pay a
-- link for an order that no longer exists).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_link_id TEXT;

-- =========================
-- Order history: one row per status change, linked to its order.
-- source = what made the change: checkout (order created), square_return /
-- square_webhook / cleanup (payment verified with Square by the return page,
-- the webhook, or the daily abandoned-checkout job), staff (staff board),
-- backfill (orders that existed before this table — their current status at
-- received_at).
-- Deleting an order deletes its history with it (ON DELETE CASCADE).
-- =========================
CREATE TABLE IF NOT EXISTS order_events (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES orders (order_number) ON DELETE CASCADE,
  status order_status NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('checkout', 'square_return', 'square_webhook', 'cleanup', 'staff', 'backfill')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_number, created_at);

-- Give orders created before order_events existed a starting entry. Every
-- code path now writes its own events, so after the first run this matches
-- nothing.
INSERT INTO order_events (order_number, status, source, created_at)
SELECT o.order_number, o.status, 'backfill', o.received_at
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_number = o.order_number);

-- =========================
-- Failed staff logins, for the lockout in api/staff-login.js: 5 wrong tries
-- from one IP, or 30 from anywhere, within 15 minutes blocks new logins for a
-- while. Needed because the staff PIN is short. Rows older than a day are
-- deleted by the login handler itself.
-- =========================
CREATE TABLE IF NOT EXISTS staff_login_failures (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_login_failures_created_idx ON staff_login_failures (created_at);

-- =========================
-- Data rules the database enforces even if the code has a bug.
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, hence the DO block.
-- =========================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_matches') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_total_matches CHECK (total = subtotal + packing_fee);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amounts_not_negative') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_amounts_not_negative CHECK (subtotal >= 0 AND packing_fee >= 0 AND total >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_ordering_mode_valid') THEN
    ALTER TABLE settings ADD CONSTRAINT settings_ordering_mode_valid CHECK (key <> 'ordering_mode' OR value IN ('auto', 'open', 'closed'));
  END IF;
END $$;
