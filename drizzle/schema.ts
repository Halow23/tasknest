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

/** Institution-wide domains that are allowed to create a TaskNest session. */
export const accessAllowedDomains = mysqlTable(
  "access_allowed_domains",
  {
    id: int("id").autoincrement().primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("access_allowed_domain_unique").on(table.domain)],
);

/** Individually approved email addresses for specific external collaborators. */
export const allowedExternalEmails = mysqlTable(
  "allowed_external_emails",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    note: varchar("note", { length: 240 }),
    expiresAt: timestamp("expiresAt"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("allowed_external_email_unique").on(table.email),
    index("allowed_external_email_expiry_idx").on(table.expiresAt),
  ],
);

export const deniedSignInReason = ["missing_email", "email_not_approved"] as const;

/** Login-denial metadata. Session cookies, OAuth codes, and IP addresses are never stored here. */
export const deniedSignInEvents = mysqlTable(
  "denied_sign_in_events",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptedEmail: varchar("attemptedEmail", { length: 320 }),
    emailDomain: varchar("emailDomain", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    reason: mysqlEnum("reason", deniedSignInReason).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("denied_sign_in_created_idx").on(table.createdAt)],
);

/** Active repeat-denial indicators. The owner receives a throttled alert; all admins can review these in-app. */
export const deniedSignInAlerts = mysqlTable(
  "denied_sign_in_alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    emailDomain: varchar("emailDomain", { length: 255 }).notNull(),
    recentAttemptCount: int("recentAttemptCount").notNull().default(0),
    windowStartedAt: timestamp("windowStartedAt").notNull(),
    lastDeniedAt: timestamp("lastDeniedAt").notNull(),
    lastNotifiedAt: timestamp("lastNotifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("denied_sign_in_alert_domain_unique").on(table.emailDomain),
    index("denied_sign_in_alert_recent_idx").on(table.lastDeniedAt),
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
export const taskRecurrenceRule = ["none", "daily", "weekly", "monthly"] as const;
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
    recurrenceRule: mysqlEnum("recurrenceRule", taskRecurrenceRule).notNull().default("none"),
    dueAt: timestamp("dueAt"),
    sortOrder: int("sortOrder").notNull().default(0),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestamp("completedAt"),
    deletedAt: timestamp("deletedAt"),
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

/** Per-project custom field definitions for tasks. */
/** Prerequisite links between tasks in the same project: dependsOnTaskId must reach done before taskId can. */
export const taskDependencies = mysqlTable(
  "task_dependencies",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: int("dependsOnTaskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_dependency_unique").on(table.taskId, table.dependsOnTaskId),
    index("task_dependency_depends_idx").on(table.dependsOnTaskId),
  ],
);

export const projectFieldType = ["text", "select", "date"] as const;

export const projectFields = mysqlTable(
  "project_fields",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    type: mysqlEnum("type", projectFieldType).notNull().default("text"),
    /** Select-field options as a plain string array; null for text/date fields. */
    options: json("options"),
    sortOrder: int("sortOrder").notNull().default(0),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_field_name_unique").on(table.projectId, table.name),
    index("project_field_order_idx").on(table.projectId, table.sortOrder),
  ],
);

/** Stored custom field answers for a task. Dates are stored as YYYY-MM-DD strings. */
export const taskFieldValues = mysqlTable(
  "task_field_values",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    fieldId: int("fieldId").notNull().references(() => projectFields.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 2000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_field_value_unique").on(table.taskId, table.fieldId),
    index("task_field_value_field_idx").on(table.fieldId),
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

/** Workspace-level labels/tags for cross-project categorization. */
export const labels = mysqlTable(
  "labels",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#38A9F2"),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("label_workspace_name_unique").on(table.workspaceId, table.name)],
);

/** Join table attaching labels to tasks. */
export const taskLabels = mysqlTable(
  "task_labels",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    labelId: int("labelId").notNull().references(() => labels.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_label_unique").on(table.taskId, table.labelId),
    index("task_label_label_idx").on(table.labelId),
  ],
);

export const notificationType = ["assigned", "commented", "mentioned", "due_today", "overdue", "automation"] as const;

/** In-app notifications for a user. Notifications are never deleted; readAt marks them seen. */
export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", notificationType).notNull(),
    actorId: int("actorId").notNull().references(() => users.id, { onDelete: "restrict" }),
    taskId: int("taskId").references(() => tasks.id, { onDelete: "cascade" }),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_read_idx").on(table.userId, table.readAt),
    index("notification_created_idx").on(table.createdAt),
  ],
);

/** Reusable task blueprints for repeated workflows. Applied copies reset scheduling. */
export const taskTemplates = mysqlTable(
  "task_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    priority: mysqlEnum("priority", taskPriority).notNull().default("medium"),
    recurrenceRule: mysqlEnum("recurrenceRule", taskRecurrenceRule).notNull().default("none"),
    /** Ordered subtask titles applied when the template is used. */
    subtaskTitles: json("subtaskTitles"),
    /** Label ids attached when the template is used. */
    labelIds: json("labelIds"),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("task_template_workspace_idx").on(table.workspaceId)],
);

/** Manual and timer-based work logs against a task. */
export const timeEntries = mysqlTable(
  "time_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    minutes: int("minutes").notNull(),
    note: varchar("note", { length: 240 }),
    loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  },
  (table) => [index("time_entry_task_idx").on(table.taskId), index("time_entry_user_idx").on(table.userId)],
);

export const automationTrigger = ["task_created", "task_completed", "comment_added"] as const;
export const automationAction = ["assign_user", "set_priority", "move_status", "notify_user"] as const;

/** Rule-based workspace automations evaluated when activity events fire. */
export const automationRules = mysqlTable(
  "automation_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    trigger: mysqlEnum("trigger", automationTrigger).notNull(),
    action: mysqlEnum("action", automationAction).notNull(),
    /** userId for assign_user/notify_user, an enum value for set_priority/move_status. */
    actionValue: varchar("actionValue", { length: 240 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("automation_rule_workspace_idx").on(table.workspaceId, table.trigger)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type TaskStatus = (typeof taskStatus)[number];
export type TaskPriority = (typeof taskPriority)[number];
export type ProjectFieldType = (typeof projectFieldType)[number];
export type NotificationType = (typeof notificationType)[number];
export type AutomationTrigger = (typeof automationTrigger)[number];
export type AutomationAction = (typeof automationAction)[number];
export type TaskRecurrenceRule = (typeof taskRecurrenceRule)[number];
export type DeniedSignInReason = (typeof deniedSignInReason)[number];
