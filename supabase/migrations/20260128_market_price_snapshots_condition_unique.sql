-- Ensure condition-aware unique key for market price cache

-- Normalize existing rows
UPDATE public.market_price_snapshots
SET condition = '2. El'
WHERE condition IS NULL;

-- Drop legacy unique constraint if present
ALTER TABLE public.market_price_snapshots
DROP CONSTRAINT IF EXISTS market_price_snapshots_product_key_key CASCADE;

-- Create condition-aware unique index
CREATE UNIQUE INDEX IF NOT EXISTS market_price_condition_unique_idx
ON public.market_price_snapshots(product_key, category, condition);
