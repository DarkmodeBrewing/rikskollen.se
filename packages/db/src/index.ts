import Database from "better-sqlite3";
import path from "node:path";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath =
      process.env.DB_PATH ??
      path.join(process.cwd(), "data", "rikskollen.sqlite");
    dbInstance = new Database(dbPath);
    dbInstance.pragma("journal_mode = WAL");
  }

  return dbInstance;
}

// Example helper
export function upsertItemFromUpstream(item: { id: string; title: string }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO items (id, title)
    VALUES (@id, @title)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title
  `);
  stmt.run(item);
}
