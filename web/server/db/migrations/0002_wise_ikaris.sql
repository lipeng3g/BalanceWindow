CREATE TABLE `user_vaults` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`schema_version` integer NOT NULL,
	`key_version` integer NOT NULL,
	`iv` text NOT NULL,
	`ciphertext` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
