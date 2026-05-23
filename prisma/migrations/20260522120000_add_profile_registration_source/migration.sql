-- Add registration_source to distinguish family vs driver-portal signups
ALTER TABLE `profiles` ADD COLUMN `registration_source` VARCHAR(32) NOT NULL DEFAULT 'FAMILY';
