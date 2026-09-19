CREATE TABLE `attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `subject_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `size` integer NOT NULL,
  `object_key` text NOT NULL UNIQUE,
  `uploaded_at` text NOT NULL,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_subject` ON `attachments` (`subject_id`);
--> statement-breakpoint
CREATE TABLE `subject_layouts` (
  `subject_id` text PRIMARY KEY NOT NULL,
  `section_order` text NOT NULL,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
