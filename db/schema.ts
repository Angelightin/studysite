import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  color: text("color").notNull(), icon: text("icon").notNull(),
  ownerId: text("owner_id"),
  position: integer("position").notNull().default(0),
}, t => [index("idx_subjects_owner").on(t.ownerId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, t => [index("idx_sessions_user").on(t.userId), index("idx_sessions_expiry").on(t.expiresAt)]);
export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(), kind: text("kind").notNull(),
  description: text("description").notNull().default(""),
  url: text("url").notNull().default(""), position: integer("position").notNull().default(0),
}, t => [index("idx_resources_subject").on(t.subjectId)]);
export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  date: text("date").notNull(), start: text("start").notNull(), end: text("end").notNull(),
  kind: text("kind").notNull(), repeat: integer("repeat").notNull().default(1),
  url: text("url").notNull().default(""),
}, t => [index("idx_lessons_subject").on(t.subjectId)]);
export const subjectNotes = sqliteTable("subject_notes", {
  subjectId: text("subject_id").primaryKey().references(() => subjects.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed").notNull().default(0),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(""),
}, t => [index("idx_tasks_subject_completed").on(t.subjectId, t.completed)]);
export const attachments = sqliteTable("attachments", {
  id:text("id").primaryKey(), subjectId:text("subject_id").notNull().references(()=>subjects.id,{onDelete:"cascade"}),
  name:text("name").notNull(), type:text("type").notNull(), size:integer("size").notNull(), objectKey:text("object_key").notNull().unique(), uploadedAt:text("uploaded_at").notNull(),
},t=>[index("idx_attachments_subject").on(t.subjectId)]);
export const subjectLayouts = sqliteTable("subject_layouts", {
  subjectId:text("subject_id").primaryKey().references(()=>subjects.id,{onDelete:"cascade"}), order:text("section_order").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(), value: text("value").notNull(),
});
