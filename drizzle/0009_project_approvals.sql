ALTER TABLE `project_assignments` ADD `assignment_type` varchar(20) NOT NULL DEFAULT 'daily';
--> statement-breakpoint
ALTER TABLE `project_assignments` ADD `is_active` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE `attendances` ADD `reported_project_id` varchar(36);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `reported_project_name` varchar(150);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `approval_status` varchar(20) NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE `attendances` ADD `approval_reason` text;
--> statement-breakpoint
ALTER TABLE `attendances` ADD `reviewed_by_id` varchar(36);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `reviewed_by_name` varchar(150);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `reviewed_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_reported_project_id_projects_id_fk` FOREIGN KEY (`reported_project_id`) REFERENCES `projects`(`id`) ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX `attendances_approval_date_idx` ON `attendances` (`approval_status`, `work_date`);
--> statement-breakpoint
CREATE INDEX `assignments_type_active_user_idx` ON `project_assignments` (`assignment_type`, `is_active`, `worker_id`);
