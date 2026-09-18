import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  color: text("color").notNull(), icon: text("icon").notNull(),
  position: integer("position").notNull().default(0),
});
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
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(), value: text("value").notNull(),
});
