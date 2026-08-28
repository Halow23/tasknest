import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * OAuth identities managed by the application framework. The built-in role is
 * intentionally not used for TaskNest authorization: workspace membership is
 * the access boundary for all collaborative data.
 */
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

export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const workspaceMembers = mysqlTable(
  "workspace_members",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_member_unique").on(table.workspaceId, table.userId),
    index("workspace_member_user_idx").on(table.userId),
  ],
);

/** Secure, expiring invitation links. These are membership onboarding records, not roles. */
export const workspaceInvites = mysqlTable(
  "workspace_invites",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull(),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    recipientEmail: varchar("recipientEmail", { length: 320 }),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    acceptedById: int("acceptedById").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invite_token_unique").on(table.token),
    index("workspace_invite_workspace_idx").on(table.workspaceId),
  ],
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 16 }).notNull().default("#38A9F2"),
    archived: boolean("archived").notNull().default(false),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("project_workspace_idx").on(table.workspaceId, table.archived)],
);

export const taskStatus = ["backlog", "progress", "review", "done"] as const;
export const taskPriority = ["high", "medium", "low"] as const;

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", taskStatus).notNull().default("backlog"),
    priority: mysqlEnum("priority", taskPriority).notNull().default("medium"),
    dueAt: timestamp("dueAt"),
    sortOrder: int("sortOrder").notNull().default(0),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("task_project_status_order_idx").on(table.projectId, table.status, table.sortOrder),
    index("task_due_idx").on(table.dueAt),
  ],
);

export const taskAssignees = mysqlTable(
  "task_assignees",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_assignee_unique").on(table.taskId, table.userId),
    index("task_assignee_user_idx").on(table.userId),
  ],
);

export const subtasks = mysqlTable(
  "subtasks",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    completed: boolean("completed").notNull().default(false),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("subtask_task_order_idx").on(table.taskId, table.sortOrder)],
);

export const comments = mysqlTable(
  "comments",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    authorId: int("authorId").notNull().references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("comment_task_created_idx").on(table.taskId, table.createdAt)],
);

/** Attachment metadata only—the actual bytes live in object storage. */
export const attachments = mysqlTable(
  "attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    uploadedById: int("uploadedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    fileName: varchar("fileName", { length: 240 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    byteSize: int("byteSize").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("attachment_task_idx").on(table.taskId)],
);

export const activityEventType = [
  "task_created",
  "task_updated",
  "task_moved",
  "task_completed",
  "subtask_updated",
  "comment_added",
  "attachment_added",
  "member_joined",
] as const;

export const activityEvents = mysqlTable(
  "activity_events",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "cascade" }),
    taskId: int("taskId").references(() => tasks.id, { onDelete: "cascade" }),
    actorId: int("actorId").notNull().references(() => users.id, { onDelete: "restrict" }),
    type: mysqlEnum("type", activityEventType).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("activity_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("activity_task_created_idx").on(table.taskId, table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type TaskStatus = (typeof taskStatus)[number];
export type TaskPriority = (typeof taskPriority)[number];
