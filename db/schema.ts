import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  usernameKey: text("username_key").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("sessions_account_idx").on(table.accountId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("auth_limits_expiry_idx").on(table.expiresAt)]);

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    progressBasis: text("progress_basis", { enum: ["slides", "study"] }).notNull().default("slides"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("courses_owner_name_uq").on(table.ownerId, table.name)],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("chapters_course_number_uq").on(
      table.courseId,
      table.chapterNumber,
    ),
  ],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["slides", "study"] }).notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    r2Key: text("r2_key").notNull(),
    size: integer("size").notNull(),
    readingPage: integer("reading_page"),
    readingTotal: integer("reading_total"),
    readingUpdatedAt: integer("reading_updated_at"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("assets_chapter_kind_idx").on(table.chapterId, table.kind)],
);

// Keep effort history even if a course/file is subsequently removed. Only the
// owning account is a foreign key; names and chapter numbers are snapshots.
export const studySessions = sqliteTable("study_sessions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull(),
  courseName: text("course_name").notNull(),
  chapterNumber: integer("chapter_number").notNull(),
  startedAt: integer("started_at").notNull(),
}, table => [index("study_sessions_account_time_idx").on(table.accountId, table.startedAt)]);

export const studyTicks = sqliteTable("study_ticks", {
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  bucketStart: integer("bucket_start").notNull(),
  sessionId: text("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull(),
  assetId: text("asset_id").notNull(),
  activeMs: integer("active_ms").notNull(),
}, table => [primaryKey({ columns: [table.accountId, table.bucketStart] }), index("study_ticks_session_idx").on(table.sessionId)]);
