-- Migration 003: Add updated_at to contact_messages (consistency with products/orders)
-- Safe to run multiple times thanks to IF NOT EXISTS.
--------------------------------------------------------------------------------

alter table public.contact_messages
    add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at fresh automatically (matches products/orders tables)
drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at
    before update on public.contact_messages
    for each row execute function public.set_updated_at();