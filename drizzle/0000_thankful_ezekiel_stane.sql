CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`r2_key` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_chapter_kind_uq` ON `assets` (`chapter_id`,`kind`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_course_number_uq` ON `chapters` (`course_id`,`chapter_number`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_owner_name_uq` ON `courses` (`owner_id`,`name`);