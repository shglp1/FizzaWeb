-- Add city and service_area to drivers table for geographic assignment matching.
-- Nullable columns so existing driver rows are unaffected.
-- Backfill: copy from latest approved DriverApplication per driver's profile_id.

ALTER TABLE drivers
  ADD COLUMN city VARCHAR(191) NULL,
  ADD COLUMN service_area VARCHAR(191) NULL;

-- Index to support city-based filtering in available-drivers queries.
CREATE INDEX drivers_city_idx ON drivers (city);

-- Backfill city and service_area from most recently approved DriverApplication.
UPDATE drivers d
  JOIN (
    SELECT da.user_id, da.city, da.service_area,
           ROW_NUMBER() OVER (PARTITION BY da.user_id ORDER BY da.reviewed_at DESC) AS rn
    FROM driver_applications da
    WHERE da.status = 'APPROVED'
  ) latest ON latest.user_id = d.profile_id AND latest.rn = 1
SET d.city = latest.city,
    d.service_area = latest.service_area;

-- Add updated_by to system_configurations for audit trail.
ALTER TABLE system_configurations
  ADD COLUMN updated_by VARCHAR(191) NULL;
