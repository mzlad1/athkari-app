-- Track per-timezone sends so each tz fires independently
CREATE TABLE public.notification_template_tz_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id bigint NOT NULL REFERENCES public.notification_templates(id),
  timezone text NOT NULL,
  sent_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, timezone, sent_date)
);
