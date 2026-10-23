// Wails v2 architecture probe, not a production installer.
// A packaged Python API sidecar and its authenticated IPC remain to be built.
package main

import (
 "embed"
 "io/fs"
 "log"
 "net/http"
 "path"
 "strings"

 "github.com/wailsapp/wails/v2"
 "github.com/wailsapp/wails/v2/pkg/options"
 "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// Next's static export uses /agente.html; links use /agente.
// Avoid importing a Next.js Node server just to support deep links.
func staticHandler() http.Handler {
 subtree, err := fs.Sub(assets,"frontend/dist")
 if err != nil { log.Fatal(err) }
 server := http.FileServer(http.FS(subtree))
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) {
  if r.Method!="GET" && r.Method!="HEAD" {
   http.Error(w,"Method not allowed",http.StatusMethodNotAllowed)
   return
  }
  clean:=path.Clean("/"+r.URL.Path)
  if clean!="/"&&!strings.Contains(path.Base(clean),".") {
   copyRequest:=r.Clone(r.Context())
   u:=*r.URL
   u.Path=clean+".html"
   copyRequest.URL=&u
   server.ServeHTTP(w,copyRequest)
   return
  }
  server.ServeHTTP(w,r)
 })
}

func main() {
 err:=wails.Run(&options.App{
  Title:"Alinha Desktop — prova de arquitetura em Go",
  Width:1250,Height:830,MinWidth:900,MinHeight:600,
  AssetServer:&assetserver.Options{Handler:staticHandler()},
 })
 if err!=nil {log.Fatal(err)}
}
