-- Add QR login token columns to kids table
ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS qr_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_expires_at timestamptz;
