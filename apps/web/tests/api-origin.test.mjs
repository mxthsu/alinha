import test from "node:test";
import assert from "node:assert/strict";
import {resolveApiOrigin} from "../src/lib/api-origin.ts";

test("localhost and IPv4 loopback use the same hostname as the web app",()=>{
  assert.equal(resolveApiOrigin("localhost"),"http://localhost:8000");
  assert.equal(resolveApiOrigin("127.0.0.1"),"http://127.0.0.1:8000");
});
test("no arbitrary browser host can become the local API destination",()=>{
  assert.equal(resolveApiOrigin("fake.example"),"http://localhost:8000");
  assert.equal(resolveApiOrigin("10.0.0.1"),"http://localhost:8000");
});
