-- ============================================================================
-- AM SRI PETSHOP — Add customer_id column to orders table
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================================

-- Step 1: Add customer_id column (if it does not exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_id') THEN
        ALTER TABLE public.orders ADD COLUMN customer_id text;
        RAISE NOTICE 'Added customer_id column to orders table';
    ELSE
        RAISE NOTICE 'customer_id column already exists';
    END IF;
END
$$;

-- Step 2: Migrate customerId from address JSONB to the real column
UPDATE public.orders
SET customer_id = address->>'customerId'
WHERE customer_id IS NULL
  AND address IS NOT NULL
  AND address->>'customerId' IS NOT NULL;

-- Step 3: Create index on customer_id for fast lookups
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);

-- Step 4: Verify the migration
SELECT 
    order_id,
    customer_id,
    customer_name,
    customer_email,
    CASE 
        WHEN customer_id IS NOT NULL THEN 'Has customer_id'
        ELSE 'No customer_id'
    END as status
FROM public.orders
ORDER BY created_at DESC;

-- Step 5: Show summary
SELECT 
    COUNT(*) as total_orders,
    COUNT(customer_id) as orders_with_customer_id,
    COUNT(*) - COUNT(customer_id) as orders_without_customer_id
FROM public.orders;
