-- Sprint R.105: site_regions.sort_order
-- Center-side display order. Site list groups by this, then site name.

ALTER TABLE site_regions
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN site_regions.sort_order IS 'Display order; smaller first. Site list groups by this.';

CREATE INDEX IF NOT EXISTS idx_site_regions_sort_order ON site_regions(sort_order);

-- Backfill 1..n by code only when every row is still 0
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM site_regions)
     AND NOT EXISTS (SELECT 1 FROM site_regions WHERE sort_order <> 0)
  THEN
    UPDATE site_regions sr
    SET sort_order = sub.rn
    FROM (
      SELECT code, ROW_NUMBER() OVER (ORDER BY code ASC) AS rn
      FROM site_regions
    ) sub
    WHERE sr.code = sub.code;
  END IF;
END $$;
