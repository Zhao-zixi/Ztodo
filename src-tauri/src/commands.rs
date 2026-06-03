use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================
//  Task types
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub note: String,
    pub category: String,
    pub priority: i32,
    pub due_date: Option<String>,
    pub status: String,
    pub progress: i32,
    pub parent_id: Option<i64>,
    pub sort_order: i32,
    pub skill_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

const TASK_SELECT_COLUMNS: &str = "id, title, note, category, priority, due_date, status, progress, parent_id, sort_order, skill_id, created_at, updated_at";

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        note: row.get(2)?,
        category: row.get(3)?,
        priority: row.get(4)?,
        due_date: row.get(5)?,
        status: row.get(6)?,
        progress: row.get(7)?,
        parent_id: row.get(8)?,
        sort_order: row.get(9)?,
        skill_id: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

// ============================================================
//  Skill types
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Skill {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub category: String,
    pub steps: String,       // JSON: [{"order":1,"content":"..."}]
    pub tips: String,
    pub tags: String,        // JSON: ["tag1","tag2"]
    pub usage_count: i32,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

const SKILL_SELECT_COLUMNS: &str = "id, name, description, category, steps, tips, tags, usage_count, last_used_at, created_at, updated_at";

fn row_to_skill(row: &rusqlite::Row) -> rusqlite::Result<Skill> {
    Ok(Skill {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        category: row.get(3)?,
        steps: row.get(4)?,
        tips: row.get(5)?,
        tags: row.get(6)?,
        usage_count: row.get(7)?,
        last_used_at: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

// ============================================================
//  Stats types
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusCount {
    pub status: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryCount {
    pub category: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskStats {
    pub total: i32,
    pub completed: i32,
    pub by_status: Vec<StatusCount>,
    pub by_category: Vec<CategoryCount>,
}

// ============================================================
//  Task input types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub note: Option<String>,
    pub category: Option<String>,
    pub priority: Option<i32>,
    pub due_date: Option<String>,
    pub parent_id: Option<i64>,
    pub status: Option<String>,
    pub skill_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub id: i64,
    pub title: Option<String>,
    pub note: Option<String>,
    pub category: Option<String>,
    pub priority: Option<i32>,
    pub due_date: Option<String>,
    pub status: Option<String>,
    pub progress: Option<i32>,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct BatchUpdateInput {
    pub ids: Vec<i64>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub priority: Option<i32>,
}

// ============================================================
//  Skill input types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct CreateSkillInput {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub steps: Option<String>,  // JSON string
    pub tips: Option<String>,
    pub tags: Option<String>,   // JSON string
}

#[derive(Debug, Deserialize)]
pub struct UpdateSkillInput {
    pub id: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub steps: Option<String>,
    pub tips: Option<String>,
    pub tags: Option<String>,
    pub usage_count: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct InstantiateSkillInput {
    pub skill_id: i64,
    pub due_date: Option<String>,
    pub priority: Option<i32>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InstantiateResult {
    pub parent: Task,
    pub subtasks: Vec<Task>,
}

// ============================================================
//  TaskWithSubtasks
// ============================================================

#[derive(Debug, Serialize)]
pub struct TaskWithSubtasks {
    pub task: Task,
    pub subtasks: Vec<Task>,
}

// ============================================================
//  ── Task Commands ──
// ============================================================

#[tauri::command]
pub fn get_all_tasks(
    db: State<Database>,
    status: Option<String>,
    category: Option<String>,
) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut where_clauses: Vec<String> = vec![];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(s) = &status {
        where_clauses.push("status = ?".into());
        params.push(Box::new(s.clone()));
    }
    if let Some(c) = &category {
        where_clauses.push("category = ?".into());
        params.push(Box::new(c.clone()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT {TASK_SELECT_COLUMNS} FROM tasks {where_sql}
         ORDER BY
           CASE status
             WHEN '进行中' THEN 0
             WHEN '等待中' THEN 1
             WHEN '待开始' THEN 2
             WHEN '已搁置' THEN 3
             WHEN '已完成' THEN 4
             ELSE 5
           END,
           created_at DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let tasks = stmt
        .query_map(param_refs.as_slice(), row_to_task)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn get_task(db: State<Database>, id: i64) -> Result<TaskWithSubtasks, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get the task itself
    let sql = format!("SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE id = ?1");
    let task: Task = conn
        .query_row(&sql, [id], row_to_task)
        .map_err(|e| format!("任务不存在: {e}"))?;

    // Get subtasks
    let subs_sql = format!(
        "SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE parent_id = ?1 ORDER BY sort_order"
    );
    let mut stmt = conn.prepare(&subs_sql).map_err(|e| e.to_string())?;
    let subtasks: Vec<Task> = stmt
        .query_map([id], row_to_task)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(TaskWithSubtasks { task, subtasks })
}

#[tauri::command]
pub fn search_tasks(db: State<Database>, query: String) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let like = format!("%{query}%");
    let sql = format!(
        "SELECT {TASK_SELECT_COLUMNS} FROM tasks
         WHERE title LIKE ?1 OR note LIKE ?1
         ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let tasks = stmt
        .query_map([&like], row_to_task)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn get_subtasks(db: State<Database>, parent_id: i64) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE parent_id = ?1 ORDER BY sort_order"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let tasks = stmt
        .query_map([parent_id], row_to_task)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn get_task_stats(db: State<Database>) -> Result<TaskStats, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let total: i32 = conn
        .query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let completed: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE status = '已完成'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status ORDER BY cnt DESC")
        .map_err(|e| e.to_string())?;
    let by_status: Vec<StatusCount> = stmt
        .query_map([], |row| {
            Ok(StatusCount {
                status: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut stmt = conn
        .prepare(
            "SELECT category, COUNT(*) as cnt FROM tasks GROUP BY category ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;
    let by_category: Vec<CategoryCount> = stmt
        .query_map([], |row| {
            Ok(CategoryCount {
                category: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(TaskStats {
        total,
        completed,
        by_status,
        by_category,
    })
}

#[tauri::command]
pub fn batch_update_tasks(
    db: State<Database>,
    input: BatchUpdateInput,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut sets: Vec<String> =
        vec!["updated_at = datetime('now','localtime')".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &input.status {
        sets.push("status = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.category {
        sets.push("category = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = input.priority {
        sets.push("priority = ?".into());
        params.push(Box::new(v));
    }

    // Build IN clause placeholders
    let placeholders: Vec<String> = input.ids.iter().enumerate().map(|(i, _)| {
        let idx = params.len() + i + 1;
        format!("?{idx}")
    }).collect();
    let in_clause = placeholders.join(", ");

    for id in &input.ids {
        params.push(Box::new(*id));
    }

    let sql = format!(
        "UPDATE tasks SET {} WHERE id IN ({})",
        sets.join(", "),
        in_clause
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_tasks(
    db: State<Database>,
    ordered_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    for (i, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE tasks SET sort_order = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
            rusqlite::params![i as i32, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================================
//  Existing CRUD (modified to include skill_id)
// ============================================================

#[tauri::command]
pub fn create_task(
    db: State<Database>,
    input: CreateTaskInput,
) -> Result<Task, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tasks (title, note, category, priority, due_date, parent_id, status, skill_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            input.title,
            input.note.unwrap_or_default(),
            input.category.unwrap_or_else(|| "默认".into()),
            input.priority.unwrap_or(0),
            input.due_date,
            input.parent_id,
            input.status.unwrap_or_else(|| "待开始".into()),
            input.skill_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let sql = format!("SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE id = ?1");
    conn.query_row(&sql, [id], row_to_task)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_task(
    db: State<Database>,
    input: UpdateTaskInput,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut sets: Vec<String> =
        vec!["updated_at = datetime('now','localtime')".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &input.title {
        sets.push("title = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.note {
        sets.push("note = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.category {
        sets.push("category = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = input.priority {
        sets.push("priority = ?".into());
        params.push(Box::new(v));
    }
    if let Some(v) = &input.due_date {
        sets.push("due_date = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.status {
        sets.push("status = ?".into());
        params.push(Box::new(v.clone()));

        if v == "已完成" {
            sets.push("progress = 100".into());
        } else if v == "待开始" {
            sets.push("progress = 0".into());
        }
    }
    if let Some(v) = input.progress {
        sets.push("progress = ?".into());
        params.push(Box::new(v));
    }
    if let Some(v) = input.parent_id {
        sets.push("parent_id = ?".into());
        params.push(Box::new(v));
    }

    let sql = format!("UPDATE tasks SET {} WHERE id = ?", sets.join(", "));
    params.push(Box::new(input.id));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_task(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================
//  ── Skill Commands ──
// ============================================================

#[tauri::command]
pub fn list_skills(
    db: State<Database>,
    category: Option<String>,
    tag: Option<String>,
) -> Result<Vec<Skill>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut where_clauses: Vec<String> = vec![];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(c) = &category {
        where_clauses.push("category = ?".into());
        params.push(Box::new(c.clone()));
    }
    if let Some(t) = &tag {
        where_clauses.push("tags LIKE ?".into());
        params.push(Box::new(format!("%\"{t}\"%"))); // JSON array 模糊匹配
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT {SKILL_SELECT_COLUMNS} FROM skills {where_sql} ORDER BY usage_count DESC, updated_at DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let skills = stmt
        .query_map(param_refs.as_slice(), row_to_skill)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(skills)
}

#[tauri::command]
pub fn get_skill(db: State<Database>, id: i64) -> Result<Skill, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {SKILL_SELECT_COLUMNS} FROM skills WHERE id = ?1");
    conn.query_row(&sql, [id], row_to_skill)
        .map_err(|e| format!("技能不存在: {e}"))
}

#[tauri::command]
pub fn create_skill(
    db: State<Database>,
    input: CreateSkillInput,
) -> Result<Skill, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO skills (name, description, category, steps, tips, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            input.name,
            input.description.unwrap_or_default(),
            input.category.unwrap_or_else(|| "默认".into()),
            input.steps.unwrap_or_else(|| "[]".into()),
            input.tips.unwrap_or_default(),
            input.tags.unwrap_or_else(|| "[]".into()),
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let sql = format!("SELECT {SKILL_SELECT_COLUMNS} FROM skills WHERE id = ?1");
    conn.query_row(&sql, [id], row_to_skill)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_skill(
    db: State<Database>,
    input: UpdateSkillInput,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut sets: Vec<String> =
        vec!["updated_at = datetime('now','localtime')".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &input.name {
        sets.push("name = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.description {
        sets.push("description = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.category {
        sets.push("category = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.steps {
        sets.push("steps = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.tips {
        sets.push("tips = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = &input.tags {
        sets.push("tags = ?".into());
        params.push(Box::new(v.clone()));
    }
    if let Some(v) = input.usage_count {
        sets.push("usage_count = ?".into());
        params.push(Box::new(v));
    }

    let sql = format!("UPDATE skills SET {} WHERE id = ?", sets.join(", "));
    params.push(Box::new(input.id));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_skill(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM skills WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_task_as_skill(
    db: State<Database>,
    task_id: i64,
) -> Result<Skill, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // 1. Read task
    let task_sql = format!("SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE id = ?1");
    let task: Task = conn
        .query_row(&task_sql, [task_id], row_to_task)
        .map_err(|e| format!("任务不存在: {e}"))?;

    // 2. Read subtasks to build steps
    let subs_sql = format!(
        "SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE parent_id = ?1 ORDER BY sort_order"
    );
    let mut stmt = conn.prepare(&subs_sql).map_err(|e| e.to_string())?;
    let subtasks: Vec<Task> = stmt
        .query_map([task_id], row_to_task)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // 3. Build steps JSON
    let steps: Vec<serde_json::Value> = if subtasks.is_empty() {
        // 没有子任务，用 note 拆分（按换行）
        task.note
            .lines()
            .filter(|l| !l.trim().is_empty())
            .enumerate()
            .map(|(i, line)| {
                serde_json::json!({"order": i + 1, "content": line.trim()})
            })
            .collect()
    } else {
        subtasks
            .iter()
            .enumerate()
            .map(|(i, sub)| {
                serde_json::json!({"order": i + 1, "content": sub.title})
            })
            .collect()
    };
    let steps_json = serde_json::to_string(&steps).map_err(|e| e.to_string())?;

    // 4. Create skill
    conn.execute(
        "INSERT INTO skills (name, description, category, steps, tips, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            task.title,
            task.note,
            task.category,
            steps_json,
            "",
            serde_json::to_string(&[&task.category]).unwrap_or_else(|_| "[]".into()),
        ],
    )
    .map_err(|e| e.to_string())?;

    let skill_id = conn.last_insert_rowid();

    // 5. Link task to skill
    conn.execute(
        "UPDATE tasks SET skill_id = ?1 WHERE id = ?2",
        rusqlite::params![skill_id, task_id],
    )
    .map_err(|e| e.to_string())?;

    // 6. Return the new skill
    let sql = format!("SELECT {SKILL_SELECT_COLUMNS} FROM skills WHERE id = ?1");
    conn.query_row(&sql, [skill_id], row_to_skill)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn instantiate_skill(
    db: State<Database>,
    input: InstantiateSkillInput,
) -> Result<InstantiateResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // 1. Read skill
    let skill_sql = format!("SELECT {SKILL_SELECT_COLUMNS} FROM skills WHERE id = ?1");
    let skill: Skill = conn
        .query_row(&skill_sql, [input.skill_id], row_to_skill)
        .map_err(|e| format!("技能不存在: {e}"))?;

    // 2. Parse steps
    let steps: Vec<serde_json::Value> =
        serde_json::from_str(&skill.steps).map_err(|e| format!("步骤解析失败: {e}"))?;

    // 3. Create parent task
    let category = input.category.unwrap_or(skill.category);
    let priority = input.priority.unwrap_or(0);
    let parent_status = "进行中".to_string();

    conn.execute(
        "INSERT INTO tasks (title, note, category, priority, due_date, status, skill_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            skill.name,
            skill.description,
            category,
            priority,
            input.due_date,
            parent_status,
            input.skill_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    let parent_id = conn.last_insert_rowid();

    // 4. Create subtasks
    let mut created_subtasks: Vec<Task> = vec![];
    for step in &steps {
        let order = step["order"].as_i64().unwrap_or(0) as i32;
        let content = step["content"].as_str().unwrap_or("");

        conn.execute(
            "INSERT INTO tasks (title, note, category, priority, due_date, parent_id, status, sort_order, skill_id)
             VALUES (?1, '', ?2, 0, NULL, ?3, '待开始', ?4, ?5)",
            rusqlite::params![content, category, parent_id, order, input.skill_id],
        )
        .map_err(|e| e.to_string())?;

        let sub_id = conn.last_insert_rowid();
        let sub_sql = format!("SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE id = ?1");
        let sub: Task = conn
            .query_row(&sub_sql, [sub_id], row_to_task)
            .map_err(|e| e.to_string())?;
        created_subtasks.push(sub);
    }

    // 5. Update skill usage stats
    conn.execute(
        "UPDATE skills SET usage_count = usage_count + 1, last_used_at = datetime('now','localtime') WHERE id = ?1",
        [input.skill_id],
    )
    .map_err(|e| e.to_string())?;

    // 6. Read back parent task
    let parent_sql = format!("SELECT {TASK_SELECT_COLUMNS} FROM tasks WHERE id = ?1");
    let parent: Task = conn
        .query_row(&parent_sql, [parent_id], row_to_task)
        .map_err(|e| e.to_string())?;

    Ok(InstantiateResult {
        parent,
        subtasks: created_subtasks,
    })
}
