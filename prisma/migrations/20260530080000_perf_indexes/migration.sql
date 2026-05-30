-- Performance optimization audit: composite and missing indexes.
-- All statements are additive (CREATE INDEX only). Zero data mutation,
-- zero rollback risk. Safe to run on staging/production with existing data.

-- driver_locations: "latest GPS for a trip" (findFirst ORDER BY recorded_at DESC)
-- and live-ops batch fetch. Avoids scanning every row for a trip.
CREATE INDEX `driver_locations_trip_id_recorded_at_idx` ON `driver_locations`(`trip_id`, `recorded_at`);

-- profiles: admin/users role + registration-source filters and summary counts.
-- The profiles table previously had no indexes at all.
CREATE INDEX `profiles_role_idx` ON `profiles`(`role`);
CREATE INDEX `profiles_registration_source_idx` ON `profiles`(`registration_source`);

-- trips: dispatch feasibility timeline (where driver_id AND scheduled_date range).
CREATE INDEX `trips_driver_id_scheduled_date_idx` ON `trips`(`driver_id`, `scheduled_date`);

-- trips: live ops / trip lists (where status IN (...) AND scheduled_date range).
CREATE INDEX `trips_status_scheduled_date_idx` ON `trips`(`status`, `scheduled_date`);

-- trips: live ops financial-review badge (count where financial_review_status = 'PENDING').
CREATE INDEX `trips_financial_review_status_idx` ON `trips`(`financial_review_status`);

-- wallet_transactions: wallet history (where wallet_id ORDER BY created_at DESC).
CREATE INDEX `wallet_transactions_wallet_id_created_at_idx` ON `wallet_transactions`(`wallet_id`, `created_at`);
