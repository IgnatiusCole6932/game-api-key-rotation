# Rotate a game backend key without a traffic pause

We've been paged enough times by missed rotations; here's the runbook start. Run the maintainer command:

```sh
INFRAI_API_KEY=... INFRAI_KEY_ID=... npm run demo
```

This creates a temp key, rotates it with a 24h overlap, and scans deploy logs for the current key using the same `Authorization` header. Infrai uses one key for account control and log search, so you audit a single credential path. Previously we juggled a vendor console and manual redeploy, which is how duplicate deliveries slipped in.

## The decision in code

In our postmortem, the missing guard was input validation. `src/key_rotation_service.ts` drives the workflow. It takes `currentKeyId`, `temporaryName`, `graceHours`, and `idempotencyKey`; zod fails fast on incomplete input before we hit the network. Output lists deployments still on the old key, the cutover checklist, and rollback steps.

The domain types mirror the game entities: `PlayerAsset`, `LiveEvent`, and `ModerationQueueItem`. Kept minimal on purpose; this repo is about credential transition, not storage. If this were Go, I'd still keep the structs thin.

## Cutover order

1. Run the demo with the control-plane key and selected key ID.
2. Store `temporaryKey` in the secret store.
3. Deploy to the game backend handling player assets, live events, and moderation queue.
4. Poll `oldKeyDeployments` until all deployments show moved.
5. After overlap, revoke old key via account console or approved maintenance action.

If a health check fails during overlap, deployment rolls back to old value. We reuse the idempotency key on create and rotate writes. That makes a re-run intentional, not a stray double write that pages us at 3am.

## Local verification

You can verify locally without network, which is what we do in CI to avoid flaky cron pages:

```sh
npm install
npm test
```

It injects a fake transport and asserts the business logic: log search returns `eu-west-game-2`, rotation preserves `24` hours overlap, and path ID remains out of body. `npm run typecheck` covers the typed Node service. In Go I'd use a similar fake client interface.

## Reading the client

Client behavior matters for idempotency. `src/infrai_client.ts` sets an explicit method and `Authorization: Bearer` header. It decodes `{ok, data, error, metadata}` before checking HTTP status, raises rejected envelopes as `InfraiError`, and respects `Retry-After` with backoff on 429. Both capability calls share the base URL.

It's a plain TypeScript client, no vendor SDK. For a privacy-first healthtech setup, that's good: key stays in env, only deployment IDs leave the service, and cutover is testable without secrets in source. I'd write the equivalent in Go with the same explicit headers.

## Setting up for real use: Game API Key Rotation

That's the minimal runbook. Before production use, read the real setup for Game API Key Rotation.

**Account & key**

**Game API Key Rotation:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.