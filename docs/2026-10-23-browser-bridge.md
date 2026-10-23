# Browser bridge v2.0.0

`createBrowserBridge(options={})` implements the `window.previs` async API. Basic editing, project validation, opening/saving and WebM export do not contact the local engine. The prerecorded sample explicitly fetches `/motions/2026-10-23-kimodo-example.json` and marks `motion.prerecorded=true` after validation.

Save/export return `{saved:true}` or `{saved:false,canceled:true}`. Open returns `{project}` or `{canceled:true}`. Native File System Access pickers are preferred; download uses an actual Blob anchor. An expired save gesture falls back to download. Input file fallback handles change/cancel/focus, and project inputs are limited to 100MB.

The optional engine address is fixed to `http://127.0.0.1:8765`. `configureConnection({code})` keeps the code only in closure memory and resets enabled state. `enableKimodo(true)` requires that code. Disabling or `disconnect()` clears it. Nothing reads/writes localStorage or sessionStorage. Status performs no request while disabled. Tokens are sent only in the model job POST body and never stored or logged by this bridge.

Jobs POST `/v1/jobs`, poll `/v1/jobs/{jobId}` every 500ms, and emit server progress through `onProgress(fn)`. The unsubscribe function removes that callback. Setup/generation have 30-minute overall limits; model install has two hours. Each status/create/cancel request times out after 15 seconds and each poll after 10 seconds. Network failures explain local engine/permission checks in Korean. `cancel()` posts `/v1/cancel`; canceled jobs return `{canceled:true}`. Generation requires 1-4000 character prompt, 0.5-60 second duration and integer seed.

Test injection options are browser abstractions: `window`, `document`, `fetch`, `sleep`, `URL`. No runtime shims or test-only classes are exported.
