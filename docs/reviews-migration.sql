-- Arc Premium Store — Reviews table migration
-- Run this ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gphrbquqmwrgxedwinvd/sql
--
-- The table is safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.reviews (
  id              TEXT        PRIMARY KEY,
  "productId"     TEXT        NOT NULL,
  "orderId"       TEXT        NOT NULL UNIQUE,
  "buyerAddress"  TEXT        NOT NULL,
  rating          INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT        NOT NULL DEFAULT '',
  "isVerified"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_product_id_idx   ON public.reviews ("productId");
CREATE INDEX IF NOT EXISTS reviews_buyer_address_idx ON public.reviews ("buyerAddress");
CREATE INDEX IF NOT EXISTS reviews_order_id_idx      ON public.reviews ("orderId");

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop policies first so re-running is safe
DROP POLICY IF EXISTS "Anyone can read reviews"   ON public.reviews;
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.reviews;

-- Allow anyone to read reviews (public catalog)
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT USING (true);

-- Allow any authenticated or anon user to insert reviews
CREATE POLICY "Anyone can insert reviews"
  ON public.reviews FOR INSERT WITH CHECK (true);
