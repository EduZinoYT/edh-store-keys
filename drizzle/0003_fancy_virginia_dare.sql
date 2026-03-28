CREATE TABLE `credential_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`localUserId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credential_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `local_credentials` ADD `groupId` int;