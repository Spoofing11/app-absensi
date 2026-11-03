ALTER TABLE `users` ADD `attendance_enabled` boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `attendance_enabled` = false WHERE `employee_type` = 'none' OR `role` = 'admin';
--> statement-breakpoint
DELETE FROM `role_permissions` WHERE `feature` = 'attendance';
