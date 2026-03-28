import { date, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const credentials = mysqlTable("credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  username: varchar("username", { length: 320 }).notNull(),
  encryptedPassword: text("encryptedPassword").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = typeof credentials.$inferInsert;

// Local authentication table (independent of Manus OAuth)
export const localUsers = mysqlTable("local_users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;

// Groups of credentials per local user
export const credentialGroups = mysqlTable("credential_groups", {
  id: int("id").autoincrement().primaryKey(),
  localUserId: int("localUserId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CredentialGroup = typeof credentialGroups.$inferSelect;
export type InsertCredentialGroup = typeof credentialGroups.$inferInsert;

// Credentials linked to local users (with optional group)
export const localCredentials = mysqlTable("local_credentials", {
  id: int("id").autoincrement().primaryKey(),
  localUserId: int("localUserId").notNull(),
  groupId: int("groupId"),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  username: varchar("username", { length: 320 }).notNull(),
  encryptedPassword: text("encryptedPassword").notNull(),
  iv: varchar("iv", { length: 128 }).notNull(),
  notes: text("notes"),
  subscriptionStart: date("subscriptionStart"),
  subscriptionDays: int("subscriptionDays"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalCredential = typeof localCredentials.$inferSelect;
export type InsertLocalCredential = typeof localCredentials.$inferInsert;
