package main

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)

func TestStaticRoutes(t *testing.T) {
    for _,route:=range []string{"/","/agente","/studio","/conexoes"} {
        req:=httptest.NewRequest(http.MethodGet,route,nil)
        response:=httptest.NewRecorder()
        staticHandler().ServeHTTP(response,req)
        if response.Code!=http.StatusOK {
            t.Errorf("route %s returned %d",route,response.Code)
        }
        if !strings.Contains(response.Body.String(),"<html") {
            t.Errorf("route %s did not return HTML",route)
        }
    }
}

func TestAssetAndDeniedMethod(t *testing.T) {
    req:=httptest.NewRequest(http.MethodGet,"/icon.svg",nil)
    response:=httptest.NewRecorder()
    staticHandler().ServeHTTP(response,req)
    if response.Code!=http.StatusOK {t.Fatalf("icon status: %d",response.Code)}
    req=httptest.NewRequest(http.MethodPost,"/agente",nil)
    response=httptest.NewRecorder()
    staticHandler().ServeHTTP(response,req)
    if response.Code!=http.StatusMethodNotAllowed {t.Fatalf("POST status: %d",response.Code)}
}
