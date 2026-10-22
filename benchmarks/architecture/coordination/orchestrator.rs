//! Synthetic Rust coordination study: no AI, external APIs or real applications.
use std::collections::{HashMap,HashSet};
use std::sync::Arc;
use std::thread;

#[derive(Debug,Clone,Copy,PartialEq,Eq)]
enum Action { Search, LoadProfile, Analyze, Prepare, Submit }
#[derive(Clone)]
struct Task { id:&'static str, action:Action, deps:Vec<&'static str>, ai_units:u32 }
#[derive(Debug,Clone,Copy,PartialEq,Eq)]
enum Status { Done, Blocked, Failed, Skipped }
#[derive(Debug)]
struct Event { id:&'static str, status:Status, reason:&'static str }
struct Coordinator {
    ai_left:u32, paused:bool, approved:bool,
    completed:HashSet<&'static str>,
}
impl Coordinator {
    fn new(ai_left:u32)->Self{
        Self{ai_left,paused:false,approved:false,completed:HashSet::new()}
    }
    fn execute(
        &mut self,
        tasks:&[Task],
        tool:Arc<dyn Fn(Action)->Result<(),String>+Send+Sync>,
    )->Vec<Event> {
        let ids:HashSet<_>=tasks.iter().map(|t|t.id).collect();
        assert_eq!(ids.len(),tasks.len(),"Duplicate IDs");
        let mut states=HashMap::new();
        let mut events=Vec::new();
        while states.len()<tasks.len() {
            let mut ready=Vec::new();
            for t in tasks {
                if states.contains_key(t.id){continue}
                let reason=if self.completed.contains(t.id) {Some(("already_done",Status::Skipped))}
                    else if self.paused {Some(("paused",Status::Blocked))}
                    else if t.action==Action::Submit && !self.approved {Some(("needs_approval",Status::Blocked))}
                    else if t.deps.iter().any(|d| !ids.contains(d)) {Some(("unknown_dependency",Status::Blocked))}
                    else if t.deps.iter().any(|d| matches!(states.get(d),Some(Status::Blocked|Status::Failed))) {Some(("dependency_failed",Status::Blocked))}
                    else {None};
                if let Some((reason,status))=reason{
                    states.insert(t.id,status);
                    events.push(Event{id:t.id,status,reason});
                    continue
                }
                if t.deps.iter().all(|d|self.completed.contains(d)){
                    if t.ai_units>self.ai_left {
                        states.insert(t.id,Status::Blocked);
                        events.push(Event{id:t.id,status:Status::Blocked,reason:"ai_budget"});
                    }else {
                        self.ai_left-=t.ai_units; // Reserve before running workers.
                        ready.push(t.clone());
                    }
                }
            }
            if !ready.is_empty() {
                let results:Vec<_>=thread::scope(|scope|{
                    let mut handlers=Vec::new();
                    for t in ready {
                        let runner=Arc::clone(&tool);
                        handlers.push(scope.spawn(move ||(t.id,runner(t.action))));
                    }
                    handlers.into_iter().map(|h|h.join().expect("Worker panic")).collect()
                });
                for (id,result) in results{
                    let (status,reason)=if result.is_ok(){
                        self.completed.insert(id);(Status::Done,"done")
                    }else{(Status::Failed,"tool_error")};
                    states.insert(id,status);
                    events.push(Event{id,status,reason});
                }
            }else if states.len()<tasks.len(){
                for t in tasks {
                    if !states.contains_key(t.id){
                        states.insert(t.id,Status::Blocked);
                        events.push(Event{id:t.id,status:Status::Blocked,reason:"unresolved_dependency"});
                    }
                }
            }
        }
        events
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    use std::sync::atomic::{AtomicUsize,Ordering};
    use std::time::Duration;
    fn t(id:&'static str,action:Action,deps:&[&'static str],ai_units:u32)->Task{
        Task{id,action,deps:deps.to_vec(),ai_units}
    }
    #[test] fn dependency_and_parallel() {
        let concurrent=Arc::new(AtomicUsize::new(0));
        let peak=Arc::new(AtomicUsize::new(0));
        let c=Arc::clone(&concurrent);let p=Arc::clone(&peak);
        let worker=Arc::new(move |_|{
            let n=c.fetch_add(1,Ordering::SeqCst)+1;
            p.fetch_max(n,Ordering::SeqCst);
            thread::sleep(Duration::from_millis(35));
            c.fetch_sub(1,Ordering::SeqCst);
            Ok(())
        });
        let tasks=[t("search",Action::Search,&[],0),t("profile",Action::LoadProfile,&[],0),
            t("analyze",Action::Analyze,&["search","profile"],20),
            t("prepare",Action::Prepare,&["analyze"],10)];
        let mut o=Coordinator::new(35);
        let events=o.execute(&tasks,worker);
        assert_eq!(events.iter().filter(|e|e.status==Status::Done).count(),4);
        assert!(peak.load(Ordering::SeqCst)>1);
        assert_eq!(o.ai_left,5);
        let pos=|name|events.iter().position(|e|e.id==name).unwrap();
        assert!(pos("analyze")>pos("search")&&pos("analyze")>pos("profile"));
        assert!(pos("prepare")>pos("analyze"));
    }
    #[test] fn budget_never_overspends() {
        let mut o=Coordinator::new(35);
        let e=o.execute(&[t("a",Action::Analyze,&[],25),t("b",Action::Prepare,&[],25)],
            Arc::new(|_|Ok(())));
        assert_eq!(e.iter().filter(|x|x.status==Status::Done).count(),1);
        assert!(e.iter().any(|x|x.reason=="ai_budget"));
        assert_eq!(o.ai_left,10);
    }
    #[test] fn no_submit_without_approval(){
        let count=Arc::new(AtomicUsize::new(0));let c=Arc::clone(&count);
        let mut o=Coordinator::new(0);
        let e=o.execute(&[t("submit",Action::Submit,&[],0)],
            Arc::new(move |_|{c.fetch_add(1,Ordering::SeqCst);Ok(())}));
        assert_eq!(e[0].reason,"needs_approval");
        assert_eq!(count.load(Ordering::SeqCst),0);
    }
    #[test] fn pause_blocks_actions(){
        let mut o=Coordinator::new(0);o.paused=true;
        let e=o.execute(&[t("search",Action::Search,&[],0)],Arc::new(|_|Ok(())));
        assert_eq!(e[0].reason,"paused");
    }
    #[test] fn idempotent_across_runs(){
        let count=Arc::new(AtomicUsize::new(0));let c=Arc::clone(&count);
        let worker=Arc::new(move |_|{c.fetch_add(1,Ordering::SeqCst);Ok(())});
        let mut o=Coordinator::new(0);
        let tasks=[t("once",Action::Search,&[],0)];
        assert_eq!(o.execute(&tasks,worker.clone())[0].status,Status::Done);
        assert_eq!(o.execute(&tasks,worker)[0].status,Status::Skipped);
        assert_eq!(count.load(Ordering::SeqCst),1);
    }
    #[test] fn failed_dependency_stops_followup(){
        let mut o=Coordinator::new(0);
        let e=o.execute(&[t("search",Action::Search,&[],0),
            t("prepare",Action::Prepare,&["search"],0)],
            Arc::new(|_|Err("fake_failure".into())));
        assert!(e.iter().any(|x|x.reason=="tool_error"));
        assert!(e.iter().any(|x|x.id=="prepare"&&x.reason=="dependency_failed"));
    }
}
