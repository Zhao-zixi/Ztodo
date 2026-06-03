mod commands;
mod db;

use commands::{
    batch_update_tasks, create_skill, create_task, delete_skill, delete_task,
    get_all_tasks, get_skill, get_subtasks, get_task, get_task_stats,
    import_task_as_skill, instantiate_skill, list_skills, reorder_tasks,
    search_tasks, update_skill, update_task,
};
use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("FATAL: app_data_dir");
            std::fs::create_dir_all(&app_dir).expect("FATAL: create_dir_all");
            let db_path = app_dir.join("ztodo.db");
            let db_path_str = db_path.to_string_lossy().to_string();

            eprintln!("[Ztodo] DB path: {db_path_str}");
            let database = Database::new(&db_path_str).expect("FATAL: Database::new");

            app.manage(database);
            eprintln!("[Ztodo] Setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Task commands (10)
            get_all_tasks,
            get_task,
            create_task,
            update_task,
            delete_task,
            search_tasks,
            get_subtasks,
            get_task_stats,
            batch_update_tasks,
            reorder_tasks,
            // Skill commands (7)
            list_skills,
            get_skill,
            create_skill,
            update_skill,
            delete_skill,
            import_task_as_skill,
            instantiate_skill,
        ])
        .run(tauri::generate_context!())
        .expect("FATAL: run");
}
