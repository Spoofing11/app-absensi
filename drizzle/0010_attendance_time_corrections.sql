CREATE TABLE `attendance_time_corrections` (
  `id` varchar(36) NOT NULL,
  `attendance_id` varchar(36) NOT NULL,
  `revision` int NOT NULL,
  `actor_user_id` varchar(36) NOT NULL,
  `actor_name` varchar(150) NOT NULL,
  `actor_username` varchar(100) NOT NULL,
  `timezone` varchar(100) NOT NULL,
  `reason` text NOT NULL,
  `before_state` json NOT NULL,
  `after_state` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `attendance_time_corrections_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
ALTER TABLE `attendance_time_corrections` ADD CONSTRAINT `attendance_time_corrections_attendance_id_attendances_id_fk` FOREIGN KEY (`attendance_id`) REFERENCES `attendances` (`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_corrections_revision_idx` ON `attendance_time_corrections` (`attendance_id`, `revision`);
