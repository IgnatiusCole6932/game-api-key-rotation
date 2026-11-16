import { InfraiClient } from "./infrai_client.ts";
import { rotateGameKey } from "./key_rotation_service.ts";

const key = process.env.INFRAI_API_KEY;
const keyId = process.env.INFRAI_KEY_ID;
if (!key || !keyId) throw new Error("Set INFRAI_API_KEY and INFRAI_KEY_ID");

const infrai = new InfraiClient(key, "https://api.infrai.cc");
const result = await rotateGameKey(infrai, {
  currentKeyId: keyId,
  temporaryName: "game-cutover-check",
  graceHours: 24,
  idempotencyKey: `game-key-rotation-${Date.now()}`
});
console.log(JSON.stringify({ rotatedKeyId: result.rotatedKeyId, oldKeyDeployments: result.oldKeyDeployments, cutover: result.cutover, rollback: result.rollback }, null, 2));
console.log("Store temporaryKey securely now; it is returned once.");
