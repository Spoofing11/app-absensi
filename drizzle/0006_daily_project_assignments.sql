-- Convert currently active legacy placements to today's date in WIB (+07:00).
-- Older closed placements remain undated archives; attendance references stay intact.
ALTER TABLE `project_assignments` ADD `work_date` date;
--> statement-breakpoint
UPDATE `project_assignments` SET `work_date` = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')) WHERE `is_active` = 1;
--> statement-breakpoint
ALTER TABLE `project_assignments` DROP INDEX `project_assignments_active_worker_id_unique`;
--> statement-breakpoint
ALTER TABLE `project_assignments` DROP COLUMN `active_worker_id`;
--> statement-breakpoint
ALTER TABLE `project_assignments` DROP COLUMN `is_active`;
--> statement-breakpoint
CREATE UNIQUE INDEX `project_assignments_worker_date_unique` ON `project_assignments` (`worker_id`, `work_date`);
--> statement-breakpoint
CREATE INDEX `project_assignments_date_project_idx` ON `project_assignments` (`work_date`, `project_id`);
