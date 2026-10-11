DROP INDEX IF EXISTS `assets_chapter_kind_uq`;
CREATE INDEX IF NOT EXISTS `assets_chapter_kind_idx` ON `assets` (`chapter_id`,`kind`);
