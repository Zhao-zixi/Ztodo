use rusqlite::{Connection, Result};
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        eprintln!("[Ztodo] Opening DB at: {db_path}");
        let conn = Connection::open(db_path)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT NOT NULL,
                note       TEXT DEFAULT '',
                category   TEXT DEFAULT '默认',
                priority   INTEGER DEFAULT 0,
                due_date   TEXT,
                status     TEXT DEFAULT '待开始',
                progress   INTEGER DEFAULT 0,
                parent_id  INTEGER,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now','localtime')),
                updated_at TEXT DEFAULT (datetime('now','localtime'))
            );",
        )?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS skills (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                description TEXT DEFAULT '',
                category    TEXT DEFAULT '默认',
                steps       TEXT NOT NULL DEFAULT '[]',
                tips        TEXT DEFAULT '',
                tags        TEXT DEFAULT '[]',
                usage_count INTEGER DEFAULT 0,
                last_used_at TEXT,
                created_at  TEXT DEFAULT (datetime('now','localtime')),
                updated_at  TEXT DEFAULT (datetime('now','localtime'))
            );",
        )?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS task_completions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id      INTEGER NOT NULL,
                skill_id     INTEGER,
                summary      TEXT DEFAULT '',
                lessons      TEXT DEFAULT '',
                completed_at TEXT DEFAULT (datetime('now','localtime'))
            );",
        )?;

        Self::migrate(&conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    fn has_column(conn: &Connection, column: &str) -> bool {
        conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name = ?1",
            [column],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0)
            > 0
    }

    fn migrate(conn: &Connection) -> Result<()> {
        let migrations = [
            ("note", "ALTER TABLE tasks ADD COLUMN note TEXT DEFAULT ''"),
            (
                "category",
                "ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT '默认'",
            ),
            (
                "priority",
                "ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0",
            ),
            ("due_date", "ALTER TABLE tasks ADD COLUMN due_date TEXT"),
            (
                "progress",
                "ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0",
            ),
            (
                "parent_id",
                "ALTER TABLE tasks ADD COLUMN parent_id INTEGER",
            ),
            (
                "sort_order",
                "ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0",
            ),
            ("created_at", "ALTER TABLE tasks ADD COLUMN created_at TEXT"),
            ("updated_at", "ALTER TABLE tasks ADD COLUMN updated_at TEXT"),
        ];

        for (column, sql) in migrations {
            if !Self::has_column(conn, column) {
                eprintln!("[Ztodo] Migrating: adding {column} column");
                conn.execute(sql, [])?;
            }
        }

        let has_status = Self::has_column(conn, "status");
        let has_legacy_is_done = Self::has_column(conn, "is_done");

        if !has_status {
            eprintln!("[Ztodo] Migrating: adding status column");
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT '待开始'",
                [],
            )?;
            if has_legacy_is_done {
                conn.execute(
                    "UPDATE tasks SET status = CASE WHEN is_done = 1 THEN '已完成' ELSE '待开始' END",
                    [],
                )?;
            }
        }

        // Migrate: add skill_id to tasks
        if !Self::has_column(conn, "skill_id") {
            eprintln!("[Ztodo] Migrating: adding skill_id column to tasks");
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN skill_id INTEGER REFERENCES skills(id)",
                [],
            )?;
        }

        eprintln!("[Ztodo] DB migration check complete");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::Database;
    use rusqlite::Connection;

    #[test]
    fn migrates_legacy_is_done_schema_without_relying_on_column_order() {
        let mut path = std::env::temp_dir();
        path.push(format!("ztodo_legacy_{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);

        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(
                "CREATE TABLE tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    note TEXT DEFAULT '',
                    category TEXT DEFAULT '默认',
                    priority INTEGER DEFAULT 0,
                    due_date TEXT,
                    is_done INTEGER DEFAULT 0,
                    progress INTEGER DEFAULT 0,
                    parent_id INTEGER,
                    sort_order INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now','localtime')),
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                );
                INSERT INTO tasks (title, is_done) VALUES ('legacy done', 1);",
            )
            .unwrap();
        }

        let db = Database::new(path.to_str().unwrap()).unwrap();
        let conn = db.conn.lock().unwrap();
        let status: String = conn
            .query_row(
                "SELECT status FROM tasks WHERE title = 'legacy done'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(status, "已完成");
        drop(conn);
        let _ = std::fs::remove_file(&path);
    }
}
