import {
  bigint,
  index,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./users.js";

/**
 * Metadata file gambar. File fisik disimpan di luar database.
 *
 * `storage_key` memakai varchar(500) agar dapat diberi unique index
 * secara langsung di MySQL.
 */
export const mediaFiles = mysqlTable(
  "media_files",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerUserId: varchar("owner_user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: varchar("purpose", { length: 30 }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    widthPx: int("width_px").notNull(),
    heightPx: int("height_px").notNull(),
    createdById: varchar("created_by_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("media_files_owner_purpose_idx").on(
      table.ownerUserId,
      table.purpose,
    ),
  ],
);
