-- Wallet financial operations: trip credit idempotency, transaction source, audit fields

ALTER TABLE wallet_transactions
  ADD COLUMN source ENUM(
    'MANUAL_ADJUSTMENT',
    'TRIP_FINANCIAL_CREDIT',
    'SUBSCRIPTION_PAYMENT',
    'TOP_UP',
    'REFUND_MANUAL_PENDING'
  ) NOT NULL DEFAULT 'MANUAL_ADJUSTMENT',
  ADD COLUMN idempotency_key VARCHAR(191) NULL,
  ADD COLUMN admin_user_id VARCHAR(191) NULL,
  ADD COLUMN reason TEXT NULL;

ALTER TABLE wallet_transactions
  ADD UNIQUE KEY wallet_transactions_idempotency_key_unique (idempotency_key),
  ADD INDEX wallet_transactions_trip_id_idx (trip_id),
  ADD INDEX wallet_transactions_source_idx (source);

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES profiles(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE trips
  ADD COLUMN wallet_credit_transaction_id VARCHAR(191) NULL;

ALTER TABLE trips
  ADD UNIQUE KEY trips_wallet_credit_transaction_id_unique (wallet_credit_transaction_id);

ALTER TABLE trips
  ADD CONSTRAINT trips_wallet_credit_transaction_id_fkey
  FOREIGN KEY (wallet_credit_transaction_id) REFERENCES wallet_transactions(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
