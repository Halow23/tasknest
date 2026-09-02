/**
 * TypeScript interfaces for every Firestore collection / subcollection.
 * IDs are always Firestore document IDs (strings). Timestamps are Firestore
 * Timestamps on the wire; the helpers convert them to Date for application use.
 *
 * Collection hierarchy:
 *   users/{uid}
 *   workspaces/{wsId}
 *   workspaces/{wsId}/projects/{projId}
 *   workspaces/{wsId}/tasks/{taskId}
 *   workspaces/{wsId}/tasks/{taskId}/comments/{commentId}
 *   workspaces/{wsId}/tasks/{taskId}/attachments/{attachId}
 *   workspaces/{wsId}/tasks/{taskId}/activity/{eventId}
 *   workspaces/{wsId}/tasks/{taskId}/timeEntries/{entryId}
 *   workspaces/{wsId}/invites/{inviteId}
 *   workspaces/{wsId}/labels/{labelId}
 *   workspaces/{wsId}/templates/{tplId}
 *   workspaces/{wsId}/automationRules/{ruleId}
 *   users/{uid}/notifications/{notifId}
 *   allowedDomains/{domain}
 *   allowedEmails/{email}
 *   deniedSignInAlerts/{domain}
 *   deniedSignInEvents/{id}
 */

// ── Scalar value types ──────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type TaskStatus = "backlog" | "progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";
export type ProjectFieldType = "text" | "select" | "date";
export type ActivityEventType =
  | "task_created" | "task_updated" | "task_moved" | "task_completed"
  | "subtask_updated" | "comment_added" | "attachment_added" | "member_joined";
export type NotificationType =
  | "assigned" | "commented" | "mentioned" | "due_today" | "overdue" | "automation";
export type AutomationTrigger = "task_created" | "task_completed" | "comment_added";
export type DeniedSignInReason =
  | "missing_email" | "email_not_approved" | "domain_not_approved";

// ── Embedded sub-types (stored inside parent documents) ────────────────────

export type WorkspaceMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  joinedAt: Date;
};

export type EmbeddedSubtask = {
  id: string;            // nanoid inside the array
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type ProjectField = {
  id: string;
  name: string;
  type: ProjectFieldType;
  options: string[] | null;  // for select fields
  sortOrder: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

// ── Top-level document types ────────────────────────────────────────────────

export type UserDoc = {
  id: string;             // === Firebase UID
  openId: string;         // same value, kept for compatibility
  name: string | null;
  email: string | null;
  role: UserRole;
  loginMethod: string;
  lastSignedIn: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceDoc = {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];  // denormalized — max ~50, safe in 1 MiB
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectDoc = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  archived: boolean;
  deletedAt: Date | null;
  createdById: string;
  fields: ProjectField[];    // embedded custom field definitions
  createdAt: Date;
  updatedAt: Date;
};

export type TaskDoc = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  titleLower: string;        // for prefix search
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  recurrenceRule: TaskRecurrence;
  dueAt: Date | null;
  sortOrder: number;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  // Denormalized join data (embedded to avoid reads-per-card on board view)
  assigneeIds: string[];
  assigneeNames: Record<string, string>;   // { uid: displayName }
  labelIds: string[];
  labelNames: Record<string, string>;      // { labelId: name }
  labelColors: Record<string, string>;     // { labelId: color }
  fieldValues: Record<string, string>;     // { fieldId: value }
  dependencies: string[];                  // taskIds this task is blocked by
  subtasks: EmbeddedSubtask[];
};

export type CommentDoc = {
  id: string;
  taskId: string;
  workspaceId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AttachmentDoc = {
  id: string;
  taskId: string;
  workspaceId: string;
  uploadedById: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  createdAt: Date;
};

export type ActivityDoc = {
  id: string;
  taskId: string | null;
  projectId: string | null;
  workspaceId: string;
  actorId: string;
  type: ActivityEventType;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type TimeEntryDoc = {
  id: string;
  taskId: string;
  workspaceId: string;
  userId: string;
  userName: string;
  minutes: number;
  note: string | null;
  loggedAt: Date;
};

export type LabelDoc = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InviteDoc = {
  id: string;
  workspaceId: string;
  token: string;
  createdById: string;
  recipientEmail: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedById: string | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type NotificationDoc = {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  taskId: string | null;
  taskTitle: string | null;
  workspaceId: string;
  readAt: Date | null;
  createdAt: Date;
};

export type TemplateDoc = {
  id: string;
  workspaceId: string;
  name: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  recurrenceRule: TaskRecurrence;
  subtaskTitles: string[];
  labelIds: string[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AutomationRuleDoc = {
  id: string;
  workspaceId: string;
  trigger: AutomationTrigger;
  action: string;
  enabled: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

// ── Access management (admin-only collections) ─────────────────────────────

export type AllowedDomainDoc = {
  id: string;            // === domain string
  domain: string;
  createdById: string | null;
  createdAt: Date;
};

export type AllowedEmailDoc = {
  id: string;            // === normalized email
  email: string;
  note: string | null;
  expiresAt: Date | null;
  createdById: string | null;
  createdAt: Date;
};

export type DeniedSignInAlertDoc = {
  id: string;            // === email domain
  emailDomain: string;
  count: number;
  windowStartedAt: Date;
  lastDeniedAt: Date;
  lastNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeniedSignInEventDoc = {
  id: string;
  attemptedEmail: string | null;
  emailDomain: string | null;
  loginMethod: string | null;
  reason: DeniedSignInReason;
  createdAt: Date;
};
