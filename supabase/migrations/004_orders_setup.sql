-- Migration 004: Ensure orders table has updated_at + RLS policy for service key
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS).
-- This is the DEFINITIVE orders setup SQL — covers all earlier migrations.
--------------------------------------------------------------------------------

-- 1. Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.orders (
    order_id                 text          primary key,
    customer_id              text,
    customer_name            text          not null,
    customer_email           text          not null,
    customer_phone           text          not null,
    shipping_address         text,
    address                  jsonb,
    items                    jsonb         not null default '[]'::jsonb,
    subtotal                 numeric(10,2) not null default 0 check (subtotal >= 0),
    shipping                 numeric(10,2) not null default 0 check (shipping >= 0),
    tax                      numeric(10,2) not null default 0 check (tax >= 0),
    discount                 numeric(10,2) not null default 0 check (discount >= 0),
    promo_code               text,
    total                    numeric(10,2) not null default 0 check (total >= 0),
    payment_method           text,
    payment_details          jsonb,
    billing_same_as_shipping boolean       not null default true,
    billing_address          jsonb,
    payment_status           text          not null default 'pending',
    delivery_method          text          not null default 'standard',
    status                   text          not null default 'pending'
        check (status in ('pending','processing','shipped','delivered','cancelled')),
    tracking_number          text,
    estimated_delivery       timestamptz,
    created_at               timestamptz   not null default now(),
    updated_at               timestamptz   not null default now()
);

-- 2. Add updated_at column if missing (safe migration)
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Ensure the auto-update trigger is attached (drops old trigger first)
DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx     ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);

-- 5. Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;