// Proof-of-concept: Go orchestrator invoking an isolated native Rust browser daemon.
// No model inference, credentials, external ATS, or real applications.
package main

import (
 "context"
 "fmt"
 "os"
 "os/exec"
 "strconv"
 "strings"
 "time"
)

func run(session string, args ...string) (string,error) {
 ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
 defer cancel()
 a := append([]string{"--session",session},args...)
 cmd := exec.CommandContext(ctx,"agent-browser",a...)
 data,err:=cmd.CombinedOutput()
 if err != nil {return "",fmt.Errorf("%v: %w (%s)",args,err,data)}
 return string(data),nil
}
func required(session string,args ...string) string {
 out,err:=run(session,args...)
 if err!=nil {panic(err)}
 return out
}
func main(){
 url:=os.Getenv("BENCH_URL")
 cv:=os.Getenv("BENCH_CV")
 chrome:=os.Getenv("CHROME_PATH")
 if !strings.HasPrefix(url,"http://127.0.0.1:") || cv=="" || chrome==""{
  panic("Only loopback fixtures and explicit test paths are allowed")
 }
 if err:=os.Setenv("AGENT_BROWSER_EXECUTABLE_PATH",chrome);err!=nil{panic(err)}
 session:=fmt.Sprintf("alinha-go-rust-%d",os.Getpid())
 defer run(session,"close")
 runs:=5
 if val,err:=strconv.Atoi(os.Getenv("BENCH_RUNS"));err==nil&&val>0&&val<=30{runs=val}
 for i:=0;i<runs;i++ {
  start:=time.Now()
  required(session,"open",url)
  required(session,"fill","#fullname","Pessoa Fictícia")
  required(session,"fill","#email","pessoa@example.test")
  required(session,"fill","#phone","000000000")
  required(session,"select","#workmode","remote")
  required(session,"select","#timezone","brazil")
  required(session,"click","#next")
  required(session,"upload","#cv",cv)
  required(session,"check","#consent")
  required(session,"click","#submit")
  response:=required(session,"is","visible","#confirmation")
  if !strings.Contains(strings.ToLower(response),"true"){panic("Fixture confirmation missing: "+response)}
  fmt.Printf("go_rust_bridge run=%d latency_ms=%d valid=true ai_calls=0\n",i+1,time.Since(start).Milliseconds())
 }
}
