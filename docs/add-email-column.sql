-- Arc Premium Store — add email column to orders table
-- Run this ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gphrbquqmwrgxedwinvd/sql

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS orders_email_idx ON public.orders (email);
