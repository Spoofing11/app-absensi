ALTER TABLE `attendances` ADD `role_id_snapshot` varchar(36);--> statement-breakpoint
ALTER TABLE `attendances` ADD `role_name_snapshot` varchar(100);--> statement-breakpoint
ALTER TABLE `attendances` ADD `early_reason_category` varchar(40);--> statement-breakpoint
ALTER TABLE `attendances` ADD `early_reason_text` text;--> statement-breakpoint
ALTER TABLE `attendances` ADD `early_seconds` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `attendances_role_snapshot_date_idx` ON `attendances` (`role_id_snapshot`,`work_date`);