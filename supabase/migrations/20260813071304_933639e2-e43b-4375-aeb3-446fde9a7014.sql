CREATE TABLE public.projector_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  owner_id uuid,
  label text NOT NULL DEFAULT 'Remote projector',
  enabled boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  scene jsonb,
  revision bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.projector_channels TO service_role;

ALTER TABLE public.projector_channels ENABLE ROW LEVEL SECURITY;

CREATE INDEX projector_channels_token_idx ON public.projector_channels (token);