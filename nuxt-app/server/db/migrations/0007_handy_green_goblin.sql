CREATE TABLE `study_scope_setting` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` integer,
	`mode` text DEFAULT 'auto' NOT NULL
);
