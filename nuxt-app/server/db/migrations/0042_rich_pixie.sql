ALTER TABLE `kanji_card` ADD `source_card_id` integer REFERENCES card(id) ON DELETE set null;
