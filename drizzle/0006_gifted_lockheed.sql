CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`course_id` text NOT NULL,
	`course_name` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`started_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_sessions_account_time_idx` ON `study_sessions` (`account_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `study_ticks` (
	`account_id` text NOT NULL,
	`bucket_start` integer NOT NULL,
	`session_id` text NOT NULL,
	`course_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`active_ms` integer NOT NULL,
	PRIMARY KEY(`account_id`, `bucket_start`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_ticks_session_idx` ON `study_ticks` (`session_id`);