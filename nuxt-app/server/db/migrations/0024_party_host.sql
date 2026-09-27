CREATE TABLE `party_host` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
