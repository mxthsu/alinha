#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::PathBuf, sync::Mutex};
use alinha_desktop_host_core::{
  Backend, Preferences, ResumeInfo, inspect_chosen_resume, load_preferences, save_preferences,
};
use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

struct DesktopState {
  backend: Mutex<Option<Backend>>,
  startup_error: Option<String>,
  data_dir: PathBuf,
}
#[derive(Serialize)]
struct DesktopStatus {
  api_ready: bool,
  message: String,
}
#[tauri::command]
fn desktop_status(state: State<'_, DesktopState>) -> DesktopStatus {
  match state.backend.lock() {
    Ok(mut guard) => {
      let ready=guard.as_mut().is_some_and(|backend|backend.healthy());
      DesktopStatus {
        api_ready:ready,
        message: if ready{"API Python autenticada em execução".into()}else{
          state.startup_error.clone().unwrap_or_else(||"API Python não disponível".into())
        },
      }
    }
    Err(_) => DesktopStatus{api_ready:false,message:"Estado indisponível".into()},
  }
}
#[tauri::command]
fn get_desktop_preferences(state: State<'_,DesktopState>)->Result<Preferences,String> {
 load_preferences(&state.data_dir)
}
#[tauri::command]
fn set_desktop_preferences(state: State<'_,DesktopState>,prefs:Preferences)->Result<(),String> {
 save_preferences(&state.data_dir,&prefs)
}
/// Deliberately NO arbitrary-path argument; only a native dialog can authorize this file.
/// Only returns limited metadata. Full CV content is not copied to JavaScript by this command.
#[tauri::command]
async fn choose_resume(app:tauri::AppHandle)->Result<Option<ResumeInfo>,String> {
 let selected=app.dialog().file()
   .add_filter("Currículo", &["pdf","docx","txt"])
   .blocking_pick_file();
 let Some(file)=selected else{return Ok(None)};
 let path=file.as_path().ok_or("Escolha um arquivo do computador")?;
 inspect_chosen_resume(path).map(Some)
}

fn main() {
 tauri::Builder::default()
  .plugin(tauri_plugin_dialog::init())
  .setup(|app| {
    let data_dir=app.path().app_local_data_dir()?;
    // The proof never launches a system Python by guessing a path.
    // For local tests pass ALINHA_DESKTOP_PYTHON=<absolute path to the isolated venv>.
    // A bundled Python executable is NOT yet shipped with this proof.
    let (backend, startup_error)=match std::env::var_os("ALINHA_DESKTOP_PYTHON"){
      Some(bin)=>{
        match Backend::launch(std::path::Path::new(&bin)){
          Ok(backend)=>(Some(backend),None),
          Err(err)=>(None,Some(err)),
        }
      }
      None=>(None,Some("Python não configurado neste protótipo".into())),
    };
    app.manage(DesktopState{backend:Mutex::new(backend),startup_error,data_dir});
    Ok(())
  })
  .invoke_handler(tauri::generate_handler![
    desktop_status, get_desktop_preferences, set_desktop_preferences, choose_resume
  ])
  .on_window_event(|window,event|{
    if let tauri::WindowEvent::Destroyed=event {
      if let Some(state)=window.app_handle().try_state::<DesktopState>(){
        if let Ok(mut session)=state.backend.lock(){ session.take(); }
      }
    }
  })
  .run(tauri::generate_context!())
  .expect("Unable to start Desktop probe");
}
