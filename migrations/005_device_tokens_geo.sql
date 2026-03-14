-- Add device geo/IP columns to device_tokens (mirrors families table fields)
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS country    text,
  ADD COLUMN IF NOT EXISTS city       text,
  ADD COLUMN IF NOT EXISTS region     text,
  ADD COLUMN IF NOT EXISTS timezone   text,
  ADD COLUMN IF NOT EXISTS isp        text;
