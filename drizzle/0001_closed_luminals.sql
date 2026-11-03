CREATE TABLE `role_permissions` (
	`role_id` varchar(36) NOT NULL,
	`feature` varchar(40) NOT NULL,
	`can_create` boolean NOT NULL DEFAULT false,
	`can_read` boolean NOT NULL DEFAULT false,
	`can_edit` boolean NOT NULL DEFAULT false,
	`can_delete` boolean NOT NULL DEFAULT false,
	CONSTRAINT `role_permissions_role_id_feature_pk` PRIMARY KEY(`role_id`,`feature`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role_id` varchar(36);--> statement-breakpoint
ALTER TABLE `users` ADD `employee_type` varchar(20) DEFAULT 'karyawan' NOT NULL;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO roles (id,name,is_system) VALUES ('00000000-0000-4000-8000-000000000001','Admin',1),('00000000-0000-4000-8000-000000000002','Karyawan',0),('00000000-0000-4000-8000-000000000003','Tukang',0);
--> statement-breakpoint
UPDATE users SET role_id = CASE role WHEN 'admin' THEN '00000000-0000-4000-8000-000000000001' WHEN 'tukang' THEN '00000000-0000-4000-8000-000000000003' ELSE '00000000-0000-4000-8000-000000000002' END, employee_type=CASE role WHEN 'admin' THEN 'none' WHEN 'tukang' THEN 'tukang' ELSE 'karyawan' END WHERE role_id IS NULL;
--> statement-breakpoint
INSERT INTO role_permissions (role_id,feature,can_create,can_read,can_edit,can_delete) VALUES ('00000000-0000-4000-8000-000000000002','attendance',1,1,1,0),('00000000-0000-4000-8000-000000000003','attendance',1,1,1,0);
