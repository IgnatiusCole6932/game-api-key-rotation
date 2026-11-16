import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const rotationRequest = z.object({
  currentKeyId: z.string().min(1),
  temporaryName: z.string().min(1),
  graceHours: z.number().int().min(1).max(72),
  idempotencyKey: z.string().min(1)
});

export type PlayerAsset = { assetId: string; ownerId: string; moderationStatus: "queued" | "approved" | "rejected" };
export type LiveEvent = { eventId: string; playerIds: string[]; startsAt: string };
export type ModerationQueueItem = { assetId: string; reason: string };

type CreatedKey = { id: string; key?: string };
type RotatedKey = { key?: string; id?: string };
type LogSearch = { entries?: Array<{ message?: string; deployment?: string }> };

export async function rotateGameKey(client: InfraiClient, input: unknown) {
  const request = rotationRequest.parse(input);
  const created = await client.request<CreatedKey>("POST", "/v1/account/keys/create", {
    name: request.temporaryName,
    idempotency_key: request.idempotencyKey
  });
  if (!created.key) throw new Error("The new key was not returned for one-time storage");
  const rotated = await client.request<RotatedKey>("POST", `/v1/account/keys/rotate/${created.id}`, {
    grace_hours: request.graceHours,
    idempotency_key: request.idempotencyKey
  });
  const logs = await client.request<LogSearch>("GET", "/v1/logs/search", undefined, { q: request.currentKeyId });
  return {
    temporaryKey: created.key,
    rotatedKeyId: rotated.id ?? created.id,
    oldKeyGraceHours: request.graceHours,
    oldKeyDeployments: (logs.entries ?? []).map((entry) => entry.deployment ?? "unknown"),
    cutover: ["Deploy the returned key to every game service", "Confirm no old-key deployment remains in logs", "Revoke the old key after the grace window"],
    rollback: "Keep the old key during the grace window and redeploy it if health checks fail"
  };
}
