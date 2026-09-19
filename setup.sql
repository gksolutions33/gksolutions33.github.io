-- ============================================================
-- AppliFix Repairs — Supabase Database Setup
-- ============================================================
-- HOW TO USE:
--   1. Go to your Supabase project → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Done! Your database is ready.
-- ============================================================


-- If you already created the table, run this single line to add the area column:
ALTER TABLE IF EXISTS public.service_requests ADD COLUMN IF NOT EXISTS customer_area TEXT DEFAULT '';

-- 1. Create the service_requests table
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_requests (
  id                    BIGSERIAL PRIMARY KEY,
  mobile_number         TEXT NOT NULL,
  appliance_type        TEXT NOT NULL CHECK (appliance_type IN ('Washing Machine', 'Refrigerator')),
  brand                 TEXT NOT NULL,
  appliance_age         TEXT NOT NULL,
  customer_name         TEXT DEFAULT '',
  customer_area         TEXT DEFAULT '',
  problem_description   TEXT DEFAULT '',
  preferred_contact_time TEXT DEFAULT '',
  status                TEXT DEFAULT 'New'
                          CHECK (status IN ('New', 'Contacted', 'Service Scheduled', 'Completed', 'Cancelled')),
  admin_notes           TEXT DEFAULT '',
  is_spam               BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- 2. Auto-update updated_at on every row change
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.service_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 3. Enable Row-Level Security (RLS)
-- ────────────────────────────────────
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;


-- 4. Public (customer) can INSERT only
--    This uses the anon/public API key in app.js
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "public_can_insert" ON public.service_requests;
CREATE POLICY "public_can_insert"
  ON public.service_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Note: No SELECT/UPDATE/DELETE policy for anon role.
-- Customers cannot read or modify requests — only submit.
-- The service_role key (used in admin.js) bypasses RLS automatically.


-- 5. Add a useful index for searching by mobile number
-- ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mobile_number ON public.service_requests (mobile_number);
CREATE INDEX IF NOT EXISTS idx_created_at    ON public.service_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status        ON public.service_requests (status);
CREATE INDEX IF NOT EXISTS idx_appliance     ON public.service_requests (appliance_type);


-- ─────────────────────────────────────────────────────────────
-- Done! Your database is ready.
-- You should now see the "service_requests" table in Table Editor.
-- ─────────────────────────────────────────────────────────────
