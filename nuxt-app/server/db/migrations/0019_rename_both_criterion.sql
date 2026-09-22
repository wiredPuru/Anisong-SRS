-- Feature 72a: "both" is now spelled "title+song", one of the canonical combination criteria.
UPDATE `deck` SET `grading_criterion` = 'title+song' WHERE `grading_criterion` = 'both';--> statement-breakpoint
UPDATE `card_track` SET `criterion` = 'title+song' WHERE `criterion` = 'both';--> statement-breakpoint
UPDATE `review_log` SET `criterion` = 'title+song' WHERE `criterion` = 'both';
