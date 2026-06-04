ALTER TABLE unified_devices
ADD COLUMN IF NOT EXISTS used_slots integer;

COMMENT ON COLUMN unified_devices.used_slots IS 'Number of slots with used capacity, aggregated from tbl_slots where max_cap > rest_cap.';
