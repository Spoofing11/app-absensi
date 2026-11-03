CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`recipient_id` varchar(36) NOT NULL,
	`assignment_id` varchar(36),
	`initial_key` varchar(36),
	`project_name` varchar(150) NOT NULL,
	`project_address` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`read_at` timestamp,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_initial_key_unique` UNIQUE(`initial_key`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_id_users_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_assignment_id_project_assignments_id_fk` FOREIGN KEY (`assignment_id`) REFERENCES `project_assignments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `notifications` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_read_idx` ON `notifications` (`recipient_id`,`read_at`);
--> statement-breakpoint
INSERT INTO notifications (id,recipient_id,assignment_id,initial_key,project_name,project_address)
SELECT UUID(), a.worker_id, a.id, a.id, p.name, p.address
FROM project_assignments a
INNER JOIN projects p ON p.id=a.project_id
INNER JOIN users u ON u.id=a.worker_id
WHERE u.employee_type='tukang'
AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.initial_key=a.id);
