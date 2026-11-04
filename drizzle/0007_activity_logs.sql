CREATE TABLE `activity_logs` (
  `id` varchar(36) NOT NULL,
  `actor_name` varchar(150) NOT NULL,
  `actor_username` varchar(100) NOT NULL,
  `feature` varchar(32) NOT NULL,
  `action` varchar(32) NOT NULL,
  `detail` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `activity_logs_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE INDEX `activity_logs_time_idx` ON `activity_logs` (`created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `activity_logs_filter_idx` ON `activity_logs` (`feature`, `action`, `created_at`);
