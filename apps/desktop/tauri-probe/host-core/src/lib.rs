//! Trusted Desktop primitives, independent of Tauri and React.
pub mod api_bridge;
pub use api_bridge::{ApiClient, ApiResponse};
use serde::{Deserialize, Serialize};
use std::{
 fs::{self,File}, io::{BufRead,BufReader,Read,Write}, net::{SocketAddr,TcpStream},
 path::Path, process::{Child,Command,Stdio}, sync::mpsc, thread, time::Duration,
};

pub const MAX_RESUME_BYTES:u64 = 8*1024*1024;

#[derive(Clone,Debug,Serialize,Deserialize,PartialEq,Eq)]
#[serde(deny_unknown_fields)]
pub struct Preferences {pub schema_version:u8, pub appearance:String}
impl Default for Preferences {
 fn default()->Self{Self{schema_version:1,appearance:"system".into()}}
}
impl Preferences {
 fn validate(&self)->Result<(),String>{
  if self.schema_version!=1 || !matches!(self.appearance.as_str(),"system"|"light"|"dark"){
   return Err("Preferências inválidas".into())
  }
  Ok(())
 }
}
pub fn load_preferences(directory:&Path)->Result<Preferences,String>{
 let p=directory.join("desktop-preferences.json");
 if !p.exists(){return Ok(Preferences::default())}
 let meta=fs::symlink_metadata(&p).map_err(|_|"Preferências indisponíveis")?;
 if !meta.file_type().is_file()||meta.len()>2048{return Err("Arquivo inválido".into())}
 let value:Preferences=serde_json::from_slice(&fs::read(&p).map_err(|_|"Leitura inválida")?)
  .map_err(|_|"Formato inválido")?;
 value.validate()?;Ok(value)
}
pub fn save_preferences(directory:&Path, prefs:&Preferences)->Result<(),String>{
 prefs.validate()?;
 fs::create_dir_all(directory).map_err(|_|"Diretório indisponível")?;
 let dst=directory.join("desktop-preferences.json");
 if dst.exists() && !fs::symlink_metadata(&dst).map_err(|_|"Destino inválido")?.file_type().is_file(){
  return Err("Destino inválido".into())
 }
 let tmp=directory.join(format!("desktop-preferences-{}.tmp",std::process::id()));
 let operation=(||{
  let mut output=File::create_new(&tmp).map_err(|_|"Escrita indisponível")?;
  output.write_all(&serde_json::to_vec(prefs).map_err(|_|"Formato inválido")?)
   .map_err(|_|"Escrita indisponível")?;
  output.sync_all().map_err(|_|"Escrita indisponível")?;
  // Provisional implementation: Windows rename cannot replace an existing file.
  // This preserves fully-written JSON but is not a crash-atomic replacement on Windows.
  if dst.exists(){fs::remove_file(&dst).map_err(|_|"Atualização indisponível")?}
  fs::rename(&tmp,&dst).map_err(|_|"Atualização indisponível")?;
  Ok::<(),String>(())
 })();
 if operation.is_err(){let _=fs::remove_file(&tmp);}
 operation
}

#[derive(Clone,Debug,Serialize,Deserialize,PartialEq,Eq)]
pub struct ResumeInfo {pub name:String,pub bytes:u64,pub extension:String}
/// Caller must first open the *native OS file picker*. Never export a command
/// that accepts an arbitrary client-supplied filesystem path.
pub fn inspect_chosen_resume(path:&Path)->Result<ResumeInfo,String>{
 let meta=fs::symlink_metadata(path).map_err(|_|"Arquivo indisponível")?;
 if !meta.file_type().is_file(){return Err("Selecione um arquivo regular".into())}
 if meta.len()==0||meta.len()>MAX_RESUME_BYTES {return Err("Tamanho inválido".into())}
 let ext=path.extension().and_then(|e|e.to_str()).unwrap_or("").to_lowercase();
 if !matches!(ext.as_str(),"pdf"|"docx"|"txt"){return Err("Formato não aceito".into())}
 let name=path.file_name().and_then(|n|n.to_str()).ok_or("Nome inválido")?.to_string();
 Ok(ResumeInfo{name,bytes:meta.len(),extension:ext})
}
fn secret_token()->Result<String,String>{
 let mut bytes=[0u8;32];getrandom::fill(&mut bytes).map_err(|_|"Entropia indisponível")?;
 Ok(bytes.iter().map(|x|format!("{x:02x}")).collect::<String>())
}
#[derive(Deserialize)]
struct Ready {event:String,port:u16}
fn checked_health(port:u16,token:&str)->Result<(),String>{
 let address=SocketAddr::from(([127,0,0,1],port));
 let mut socket=TcpStream::connect_timeout(&address,Duration::from_secs(2))
  .map_err(|_|"API indisponível")?;
 socket.set_read_timeout(Some(Duration::from_secs(2))).ok();
 socket.set_write_timeout(Some(Duration::from_secs(2))).ok();
 socket.write_all(format!(
  "GET /health HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nX-Alinha-Desktop-Session: {token}\r\nConnection: close\r\n\r\n"
 ).as_bytes()).map_err(|_|"Verificação falhou")?;
 let mut raw=String::new();
 socket.take(8192).read_to_string(&mut raw).map_err(|_|"Resposta inválida")?;
 if (raw.starts_with("HTTP/1.1 200 ")||raw.starts_with("HTTP/1.0 200 "))
  &&raw.contains("\"status\":\"ok\""){Ok(())}
 else{Err("Autenticação ou prontidão recusada".into())}
}
pub struct Backend {child:Child,port:u16,secret:String}
impl Backend {
 pub fn launch(python:&Path)->Result<Self,String>{
  if !python.is_file(){return Err("Python de teste indisponível".into())}
  let secret=secret_token()?;
  let mut child=Command::new(python)
   .args(["-m","alinha_api.desktop_entry"])
   .env("ALINHA_DESKTOP_SESSION_TOKEN",&secret)
   .env("ALINHA_DEPLOYMENT_MODE","community")
   .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())
   .spawn().map_err(|_|"Falha iniciando Python")?;
  let stdout=child.stdout.take().ok_or("Canal indisponível")?;
  let (tx,rx)=mpsc::channel();
  thread::spawn(move||{
   let mut reader=BufReader::new(stdout);
   let mut first=String::new();
   let _=tx.send(reader.read_line(&mut first).map(|_|first));
   for _ in reader.lines(){} // Discard logs; never forward CV content.
  });
  let result=(||{
   let line=rx.recv_timeout(Duration::from_secs(18)).map_err(|_|"Inicialização excedeu 18s")?
    .map_err(|_|"Canal inválido")?;
   let ready:Ready=serde_json::from_str(&line).map_err(|_|"Prontidão inválida")?;
   if ready.event!="ready" || ready.port<1024 {return Err("Porta inválida".into())}
   checked_health(ready.port,&secret)?;
   Ok::<u16,String>(ready.port)
  })();
  match result{
   Ok(port)=>Ok(Self{child,port,secret}),
   Err(err)=>{let _=child.kill();let _=child.wait();Err(err)}
  }
 }
 pub fn healthy(&mut self)->bool{
  if self.child.try_wait().ok().flatten().is_some(){return false}
  checked_health(self.port,&self.secret).is_ok()
 }
 pub fn api_client(&self)->ApiClient {ApiClient{port:self.port,secret:self.secret.clone()}}
 pub fn request(&self,method:&str,path:&str,content_type:&str,body_base64:&str)->Result<ApiResponse,String>{
  self.api_client().request(method,path,content_type,body_base64)
 }
 pub fn stop(&mut self){let _=self.child.kill();let _=self.child.wait();}
}
impl Drop for Backend{fn drop(&mut self){self.stop();}}

#[cfg(test)]
mod tests{
 use super::*;
 fn sandbox()->std::path::PathBuf{
  let p=std::env::temp_dir().join(format!("alinha-host-core-{}-{:?}",
   std::process::id(),std::thread::current().id()));
  fs::create_dir_all(&p).unwrap();p
 }
 #[test]fn preferences_validate_and_persist(){
  let p=sandbox();
  assert_eq!(load_preferences(&p).unwrap().appearance,"system");
  save_preferences(&p,&Preferences{schema_version:1,appearance:"dark".into()}).unwrap();
  assert_eq!(load_preferences(&p).unwrap().appearance,"dark");
  assert!(save_preferences(&p,&Preferences{schema_version:2,appearance:"invalid".into()}).is_err());
  fs::write(p.join("desktop-preferences.json"),b"{\"schema_version\":1,\"appearance\":\"dark\",\"secret\":\"x\"}").unwrap();
  assert!(load_preferences(&p).is_err());
 }
 #[test]fn files_require_normal_extension_size_and_file_type(){
  let p=sandbox();let cv=p.join("ficticio.PDF");fs::write(&cv,b"synthetic pdf").unwrap();
  assert_eq!(inspect_chosen_resume(&cv).unwrap().extension,"pdf");
  let bad=p.join("passwords.env");fs::write(&bad,b"dummy").unwrap();
  assert!(inspect_chosen_resume(&bad).is_err());
  let empty=p.join("empty.docx");fs::write(&empty,b"").unwrap();
  assert!(inspect_chosen_resume(&empty).is_err());
  assert!(inspect_chosen_resume(&p).is_err());
 }
 #[test]fn every_process_gets_fresh_unpredictable_secret(){
  let a=secret_token().unwrap();let b=secret_token().unwrap();
  assert_eq!(a.len(),64);assert_ne!(a,b);
 }
}
