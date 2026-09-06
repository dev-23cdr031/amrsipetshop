-- Migration 002: Add missing updated_at column to orders
--
-- WHY: The orders table was created without an `updated_at` column, but the
-- project has a before-update trigger (set_updated_at / handle_updated_at)
-- that runs `NEW.updated_at = now()`. Any UPDATE on public.orders therefore
-- fails with:
--     record "new" has no field "updated_at"
-- which made admin order-status changes silently fall back to local storage.
--
-- FIX: Add the column (with default so existing rows stay valid) and attach
-- the standard auto-update trigger for orders.
--------------------------------------------------------------------------------

alter table public.orders
    add column if not exists updated_at timestamptz not null default now();

-- Make sure the auto-update trigger is attached to orders as well (matches products).
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
    before update on public.orders
    for each row execute function public.set_updated_at();

-- Optional: also surface updated_at on contact_messages for consistency.
alter table public.contact_messages
    add column if not exists updated_at timestamptz not null default now();

-- Verify it worked:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'orders' order by ordinal_position;