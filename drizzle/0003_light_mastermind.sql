ALTER TABLE `project_assignments` MODIFY COLUMN `start_date` date;--> statement-breakpoint
ALTER TABLE `project_assignments` ADD `is_active` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `project_assignments` ADD `ended_at` timestamp;--> statement-breakpoint
ALTER TABLE `project_assignments` ADD `active_worker_id` varchar(36) GENERATED ALWAYS AS (CASE WHEN is_active = 1 THEN worker_id ELSE NULL END) STORED;--> statement-breakpoint
ALTER TABLE `projects` ADD `work_schedule_id` varchar(36);--> statement-breakpoint
ALTER TABLE `roles` ADD `work_schedule_id` varchar(36);--> statement-breakpoint
ALTER TABLE `project_assignments` ADD CONSTRAINT `project_assignments_active_worker_id_unique` UNIQUE(`active_worker_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_work_schedule_id_work_schedules_id_fk` FOREIGN KEY (`work_schedule_id`) REFERENCES `work_schedules`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_work_schedule_id_work_schedules_id_fk` FOREIGN KEY (`work_schedule_id`) REFERENCES `work_schedules`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
UPDATE roles r
INNER JOIN (
 SELECT u.role_id, MIN(u.work_schedule_id) schedule_id
 FROM users u INNER JOIN work_schedules s ON s.id=u.work_schedule_id AND s.is_active=1
 WHERE u.employee_type <> 'none' AND u.role_id IS NOT NULL
 GROUP BY u.role_id HAVING COUNT(DISTINCT u.work_schedule_id)=1
) legacy ON legacy.role_id=r.id
SET r.work_schedule_id=legacy.schedule_id WHERE r.is_system=0;
--> statement-breakpoint
UPDATE project_assignments a
INNER JOIN (
 SELECT id FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY worker_id ORDER BY created_at DESC,id DESC) ranking
  FROM project_assignments
  WHERE (start_date IS NULL OR start_date<=CURRENT_DATE()) AND (end_date IS NULL OR end_date>=CURRENT_DATE())
 ) ranked WHERE ranking=1
) chosen ON chosen.id=a.id
SET a.is_active=1;
