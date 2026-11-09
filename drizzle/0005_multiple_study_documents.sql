-- Reconcile legacy databases whose many-assets SQL was not journaled.
-- Only the obsolete uniqueness constraint is removed; all files are retained.
DROP INDEX IF EXISTS `assets_chapter_kind_uq`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assets_chapter_kind_idx` ON `assets` (`chapter_id`, `kind`);
