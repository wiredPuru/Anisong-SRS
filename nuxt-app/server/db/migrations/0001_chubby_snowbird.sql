CREATE TABLE `media_library_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`library_paths` text DEFAULT '[]' NOT NULL
);
