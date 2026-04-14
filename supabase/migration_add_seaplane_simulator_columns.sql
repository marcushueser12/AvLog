-- Seaplane (sea class) and approved training device (simulator) time on verified_entries
ALTER TABLE verified_entries ADD COLUMN IF NOT EXISTS seaplane_time TEXT;
ALTER TABLE verified_entries ADD COLUMN IF NOT EXISTS simulator_time TEXT;
