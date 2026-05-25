/**
 * Backward-compatible re-exports for tests and legacy imports.
 * Upload/save functions live in storageService.ts.
 */
export {
  validateCategoryUpload,
  validateImageUpload,
  getMaxUploadBytes,
  getStorageDriver,
  validateR2Config,
  type UploadCategory,
  type StorageDriver,
} from './uploadValidation.ts';
