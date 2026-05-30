-- Add index on admin_user_id for wallet_transactions to support
-- efficient admin-level transaction filtering and audit queries.

ALTER TABLE wallet_transactions
  ADD INDEX wallet_transactions_admin_user_id_idx (admin_user_id);
