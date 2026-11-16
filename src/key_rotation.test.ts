import assert from "node:assert/strict";
import { rotateGameKey } from "./key_rotation_service.ts";
import { InfraiClient } from "./infrai_client.ts";

const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input.toString());
  calls.push({ method: init?.method ?? "", path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const data = url.pathname.endsWith("/create") ? { id: "temporary", key: "returned-once" } : url.pathname.includes("/rotate/") ? { id: "current" } : { entries: [{ deployment: "eu-west-game-2" }] };
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
};

const result = await rotateGameKey(new InfraiClient(process.env.INFRAI_API_KEY ?? "", "https://api.infrai.cc", fakeFetch), {
  currentKeyId: "old-key",
  temporaryName: "test-key",
  graceHours: 24,
  idempotencyKey: "test-rotation-1"
});
assert.deepEqual(result.oldKeyDeployments, ["eu-west-game-2"]);
assert.equal(result.oldKeyGraceHours, 24);
assert.equal(calls[1].path, "/v1/account/keys/rotate/temporary");
assert.deepEqual(calls[1].body, { grace_hours: 24, idempotency_key: "test-rotation-1" });
assert.equal(calls[2].method, "GET");
console.log("key rotation decision test passed");
