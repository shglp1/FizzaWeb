-- Task 12.1: ChatBlock model for trip chat moderation
CREATE TABLE IF NOT EXISTS chat_blocks (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  user_id VARCHAR(191) NULL,
  driver_id VARCHAR(191) NULL,
  target_type VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  blocked_by_admin_id VARCHAR(191) NOT NULL,
  starts_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ends_at DATETIME(3) NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX chat_blocks_user_id_idx (user_id),
  INDEX chat_blocks_driver_id_idx (driver_id),
  INDEX chat_blocks_active_idx (active),
  INDEX chat_blocks_target_type_idx (target_type),
  CONSTRAINT chat_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chat_blocks_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chat_blocks_blocked_by_admin_id_fkey FOREIGN KEY (blocked_by_admin_id) REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);
