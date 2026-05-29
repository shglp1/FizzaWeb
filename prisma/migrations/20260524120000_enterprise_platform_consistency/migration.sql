-- Enterprise platform consistency: trip financial review + parent service-day ratings

ALTER TABLE trips
  ADD COLUMN financial_review_status ENUM(
    'PENDING',
    'PAY_DRIVER',
    'NO_PAY_DRIVER',
    'REFUND_PARENT',
    'CREDIT_PARENT',
    'KEEP_REVENUE',
    'INCIDENT'
  ) NULL,
  ADD COLUMN financial_review_reason TEXT NULL,
  ADD COLUMN financial_reviewed_at DATETIME(3) NULL,
  ADD COLUMN financial_reviewed_by VARCHAR(191) NULL;

ALTER TABLE trips
  ADD CONSTRAINT trips_financial_reviewed_by_fkey
  FOREIGN KEY (financial_reviewed_by) REFERENCES profiles(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE trip_ratings (
  id VARCHAR(191) NOT NULL,
  rider_id VARCHAR(191) NOT NULL,
  driver_id VARCHAR(191) NOT NULL,
  parent_id VARCHAR(191) NOT NULL,
  subscription_id VARCHAR(191) NULL,
  service_date DATE NOT NULL,
  rating INT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY trip_ratings_rider_date_driver_unique (rider_id, service_date, driver_id),
  INDEX trip_ratings_parent_id_idx (parent_id),
  INDEX trip_ratings_driver_id_idx (driver_id),
  CONSTRAINT trip_ratings_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT trip_ratings_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT trip_ratings_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);
