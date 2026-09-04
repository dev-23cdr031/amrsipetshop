-- ============================================================================
-- AM SRI PETSHOP — Add customers and sessions tables for proper authentication
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================================

-- Step 1: Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id              text PRIMARY KEY DEFAULT ('cust_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 9)),
    first_name      text NOT NULL,
    last_name       text NOT NULL,
    email           text UNIQUE NOT NULL,
    phone           text NOT NULL,
    password        text NOT NULL,
    is_admin        boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers (email);

-- Step 2: Create sessions table for cross-browser login
CREATE TABLE IF NOT EXISTS public.sessions (
    token           text PRIMARY KEY DEFAULT (encode(gen_random_bytes(32), 'hex')),
    customer_id     text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_customer_id_idx ON public.sessions (customer_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions (expires_at);

-- Step 3: Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Step 4: Add policies (server uses service_role key which bypasses RLS)
-- No public policies needed - all access goes through server

-- Step 5: Migrate existing users from localStorage to Supabase
-- (This is a placeholder - you'll need to manually add existing users or re-signup)
INSERT INTO public.customers (id, first_name, last_name, email, phone, password, is_admin)
VALUES 
    ('cust_existing_1', 'DEV DHARRSHAN', 'S 23CDR031', 'devdharrshans.23csd@kongu.edu', '0908062064', '19072004@Dev', true)
ON CONFLICT (email) DO NOTHING;

-- Step 6: Verify
SELECT 'customers' as table_name, COUNT(*) as count FROM public.customers
UNION ALL
SELECT 'sessions', COUNT(*) FROM public.sessions;
