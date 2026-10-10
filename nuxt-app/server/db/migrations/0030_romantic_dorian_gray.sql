CREATE TABLE `api_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`body` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
