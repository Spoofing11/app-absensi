CREATE TABLE `accounts` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(100) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp,
	`refresh_token_expires_at` timestamp,
	`scope` varchar(255),
	`password` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` varchar(36) NOT NULL,
	`attendance_code` varchar(30) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`work_date` date NOT NULL,
	`work_schedule_id` varchar(36) NOT NULL,
	`project_assignment_id` varchar(36),
	`project_id` varchar(36),
	`user_code_snapshot` varchar(30) NOT NULL,
	`full_name_snapshot` varchar(150) NOT NULL,
	`role_snapshot` varchar(20) NOT NULL,
	`schedule_code_snapshot` varchar(30) NOT NULL,
	`schedule_name_snapshot` varchar(100) NOT NULL,
	`timezone_snapshot` varchar(100) NOT NULL,
	`project_code_snapshot` varchar(30),
	`project_name_snapshot` varchar(150),
	`scheduled_start_at` timestamp NOT NULL,
	`scheduled_end_at` timestamp NOT NULL,
	`check_in_at` timestamp NOT NULL,
	`check_in_photo_id` varchar(36),
	`check_out_at` timestamp,
	`check_out_photo_id` varchar(36),
	`late_seconds` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendances_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendances_attendance_code_unique` UNIQUE(`attendance_code`),
	CONSTRAINT `attendances_late_seconds_check` CHECK(`attendances`.`late_seconds` >= 0),
	CONSTRAINT `attendances_checkout_after_checkin_check` CHECK(`attendances`.`check_out_at` is null or `attendances`.`check_out_at` >= `attendances`.`check_in_at`)
);
--> statement-breakpoint
CREATE TABLE `media_files` (
	`id` varchar(36) NOT NULL,
	`owner_user_id` varchar(36) NOT NULL,
	`purpose` varchar(30) NOT NULL,
	`storage_key` varchar(500) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size_bytes` bigint NOT NULL,
	`width_px` int NOT NULL,
	`height_px` int NOT NULL,
	`created_by_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_files_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `project_assignments` (
	`id` varchar(36) NOT NULL,
	`assignment_code` varchar(30) NOT NULL,
	`worker_id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`notes` text,
	`created_by_id` varchar(36) NOT NULL,
	`updated_by_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_assignments_assignment_code_unique` UNIQUE(`assignment_code`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL,
	`project_code` varchar(30) NOT NULL,
	`name` varchar(150) NOT NULL,
	`address` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`planned_start_date` date,
	`planned_end_date` date,
	`notes` text,
	`created_by_id` varchar(36),
	`updated_by_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_project_code_unique` UNIQUE(`project_code`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`username` varchar(100) NOT NULL,
	`display_username` varchar(100),
	`username_normalized` varchar(100) GENERATED ALWAYS AS (lower(`username`)) STORED NOT NULL,
	`user_code` varchar(30) NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'karyawan',
	`is_active` boolean NOT NULL DEFAULT true,
	`work_schedule_id` varchar(36),
	`phone_number` varchar(30),
	`profile_photo_id` varchar(36),
	`password_changed_at` timestamp NOT NULL DEFAULT (now()),
	`created_by_id` varchar(36),
	`updated_by_id` varchar(36),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_username_normalized_unique` UNIQUE(`username_normalized`),
	CONSTRAINT `users_user_code_unique` UNIQUE(`user_code`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_schedules` (
	`id` varchar(36) NOT NULL,
	`schedule_code` varchar(30) NOT NULL,
	`name` varchar(100) NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by_id` varchar(36),
	`updated_by_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_schedules_schedule_code_unique` UNIQUE(`schedule_code`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_work_schedule_id_work_schedules_id_fk` FOREIGN KEY (`work_schedule_id`) REFERENCES `work_schedules`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_project_assignment_id_project_assignments_id_fk` FOREIGN KEY (`project_assignment_id`) REFERENCES `project_assignments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_check_in_photo_id_media_files_id_fk` FOREIGN KEY (`check_in_photo_id`) REFERENCES `media_files`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_check_out_photo_id_media_files_id_fk` FOREIGN KEY (`check_out_photo_id`) REFERENCES `media_files`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_files` ADD CONSTRAINT `media_files_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_assignments` ADD CONSTRAINT `project_assignments_worker_id_users_id_fk` FOREIGN KEY (`worker_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_assignments` ADD CONSTRAINT `project_assignments_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `accounts_provider_account_idx` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `attendances_user_date_idx` ON `attendances` (`user_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `attendances_work_date_idx` ON `attendances` (`work_date`);--> statement-breakpoint
CREATE INDEX `attendances_project_date_idx` ON `attendances` (`project_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `attendances_schedule_date_idx` ON `attendances` (`work_schedule_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `attendances_role_date_idx` ON `attendances` (`role_snapshot`,`work_date`);--> statement-breakpoint
CREATE INDEX `media_files_owner_purpose_idx` ON `media_files` (`owner_user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `project_assignments_worker_start_idx` ON `project_assignments` (`worker_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `project_assignments_project_start_idx` ON `project_assignments` (`project_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `users_role_active_idx` ON `users` (`role`,`is_active`);--> statement-breakpoint
CREATE INDEX `users_work_schedule_idx` ON `users` (`work_schedule_id`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);