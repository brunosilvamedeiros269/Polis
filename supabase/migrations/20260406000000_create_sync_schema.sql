-- Migration: Create sync configurations and deputies cache schema
CREATE TABLE IF NOT EXISTS public.sync_configs (
    entity_type TEXT PRIMARY KEY,
    interval_hours NUMERIC NOT NULL,
    last_execution TIMESTAMP WITH TIME ZONE
);

INSERT INTO public.sync_configs (entity_type, interval_hours, last_execution) 
VALUES ('deputies', 24, null)
ON CONFLICT (entity_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.deputies (
    id NUMERIC PRIMARY KEY,
    name TEXT NOT NULL,
    party TEXT,
    state TEXT,
    avatar_url TEXT,
    email TEXT,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
