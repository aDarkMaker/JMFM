/**
 * Single source of truth lives in the data layer next to the keys; this
 * module re-exports it so store code has one obvious import for persistence.
 */
export {STORAGE_VERSION} from '@/data/storage-keys';
