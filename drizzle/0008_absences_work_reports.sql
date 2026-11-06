CREATE TABLE `absences` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `work_date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `note` text,
  `employee_type` varchar(20) NOT NULL,
  `assignment_id` varchar(36),
  `project_id` varchar(36),
  `project_name` varchar(150),
  `project_code` varchar(30),
  `full_name` varchar(150) NOT NULL,
  `username` varchar(100) NOT NULL,
  `user_code` varchar(30) NOT NULL,
  `role_id` varchar(36),
  `role_name` varchar(100),
  `legacy_role` varchar(20) NOT NULL,
  `timezone` varchar(100) NOT NULL,
  `schedule_name` varchar(100),
  `scheduled_start_at` timestamp,
  `scheduled_end_at` timestamp,
  `created_by_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `absences_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `absences_user_date_unique` ON `absences` (`user_id`, `work_date`);
--> statement-breakpoint
CREATE INDEX `absences_date_project_idx` ON `absences` (`work_date`, `project_id`);
--> statement-breakpoint
CREATE INDEX `absences_assignment_idx` ON `absences` (`assignment_id`);
--> statement-breakpoint
ALTER TABLE `absences` ADD CONSTRAINT `absences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `absences` ADD CONSTRAINT `absences_assignment_id_project_assignments_id_fk` FOREIGN KEY (`assignment_id`) REFERENCES `project_assignments` (`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `absences` ADD CONSTRAINT `absences_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `attendances` ADD `employee_type_snapshot` varchar(20);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `username_snapshot` varchar(100);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `work_type` varchar(20);
--> statement-breakpoint
ALTER TABLE `attendances` ADD `work_note` text;
