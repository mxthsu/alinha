package main

import (
 "context"
 "fmt"
 "os"
 "strconv"
 "strings"
 "time"

 "github.com/chromedp/chromedp"
)

func main() {
 url := os.Getenv("BENCH_URL")
 cv := os.Getenv("BENCH_CV")
 chrome := os.Getenv("CHROME_PATH")
 if !strings.HasPrefix(url, "http://127.0.0.1:") || cv == "" || chrome == "" {
  panic("BENCH_URL must be local loopback; BENCH_CV and CHROME_PATH are required")
 }
 runs := 5
 if val, err := strconv.Atoi(os.Getenv("BENCH_RUNS")); err == nil && val > 0 && val <= 30 { runs = val }
 opts := append(chromedp.DefaultExecAllocatorOptions[:], chromedp.ExecPath(chrome), chromedp.NoSandbox)
 allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
 defer cancelAlloc()
 parent, cancelParent := chromedp.NewContext(allocCtx)
 defer cancelParent()
 if err := chromedp.Run(parent); err != nil { panic(err) }
 for i:=0; i<runs; i++ {
  child, cancelChild := chromedp.NewContext(parent)
  ctx, cancelTimeout := context.WithTimeout(child, 30*time.Second)
  start := time.Now()
  err := chromedp.Run(ctx,
   chromedp.Navigate(url),
   chromedp.WaitVisible("#fullname"),
   chromedp.SendKeys("#fullname", "Pessoa Fictícia"),
   chromedp.SendKeys("#email", "pessoa@example.test"),
   chromedp.SendKeys("#phone", "000000000"),
   chromedp.SetValue("#workmode", "remote"),
   chromedp.Evaluate(`document.querySelector("#workmode").dispatchEvent(new Event("change",{bubbles:true}))`, nil),
   chromedp.SetValue("#timezone", "brazil"),
   chromedp.Click("#next"),
   chromedp.WaitVisible("#cv"),
   chromedp.SetUploadFiles("#cv", []string{cv}),
   chromedp.Click("#consent"),
   chromedp.Click("#submit"),
   chromedp.WaitVisible("#confirmation"),
  )
  elapsed := time.Since(start).Milliseconds()
  cancelTimeout()
  cancelChild()
  if err != nil { panic(err) }
  fmt.Printf("go_chromedp run=%d latency_ms=%d valid=true ai_calls=0\n",i+1,elapsed)
 }
}
