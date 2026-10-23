# Previs Web v2.0.0 optional local engine

The static browser editor works independently. Kimodo generation requires this optional local Python connector, a compatible NVIDIA GPU, CUDA PyTorch, and access to the gated model repositories. Starting the connector does not install anything or download models.

From the project folder, using an existing Python 3.11 interpreter:

```powershell
python -B local-engine/2026-10-23-connector.py --origin https://your-exact-project.vercel.app
```

For local development use the exact development origin, for example `--origin http://localhost:5173`. A Vercel preview URL is a distinct origin: restart the connector paired to that exact URL. Do not include a trailing slash or URL path. The listener always binds only `127.0.0.1`, default port 8765; `--port` changes the port, never the bind address.

Copy the random **connection code** printed in the local terminal into the editor. It is a short-lived session secret regenerated on restart and never saved by the connector. It differs from a Hugging Face access token. Enter an HF token only when explicitly requesting model installation; the connector passes it through the child process environment, never command arguments, logs, or disk. Third-party stderr is discarded. Close the terminal or press Ctrl+C to stop; the connector cancels its owned active child process tree.

The editor sends `Authorization: Bearer <connection code>` and an exact Origin. Requests from other origins, missing/wrong codes, and unexpected Host headers are rejected. CORS uses no wildcard. OPTIONS allows Authorization and Content-Type and includes the legacy private-network preflight response. Modern Chrome may still request **Local Network Access** permission; grant it for the trusted editor if desired. Never disable browser security or use bypass flags. HTTPS deployed-site to local-loopback connectivity has not been verified in a real deployed browser; browser policies, enterprise configuration, and permission choices can prevent it.

## Explicit operations

- `GET /v1/status`: local worker status only, no model network access. Returns 409 while an operation is active.
- `POST /v1/jobs`: `{"kind":"setup","args":{}}` explicitly installs the isolated Python dependencies. This can consume substantial disk/network usage.
- `POST /v1/jobs`: `{"kind":"installModel","args":{"token":"..."}}` explicitly downloads model files after the worker's gated-access preflight. HF approval is required for the Llama base. Existing cached models are reused. No automatic model download occurs on page load or connector start.
- `POST /v1/jobs`: `{"kind":"generate","args":{"prompt":"A person walks forward","duration":3,"seed":42}}` uses local models. Duration 0.5–60 seconds; seed 0–2147483647. Returns HTTP 202 with `jobId`.
- `GET /v1/jobs/<jobId>`: state (`running`, `completed`, `failed`, `canceled`), latest `progress`, optional `result` or `error`. Completed generation includes `result.motion`, ready for the browser editor.
- `POST /v1/cancel` with `{}`: cancels only the connector's owned active worker and its Windows descendants.

Only one job runs at a time (409 while busy). Request bodies are limited to 16 KB. Job state is memory-only with at most 10 entries. Motion JSON files use unique IDs inside `local-engine/2026-10-22-runtime`. The runtime, dependencies, caches, and model assets remain in that local-engine subtree. The runtime's virtual-environment interpreter is preferred; setup uses the launching interpreter to create it. No arbitrary command, path, bind address, or model name is accepted from browser requests.

## Verification

```powershell
python -B local-engine/2026-10-23-connector-test.py
```

Standard-library tests use a real ephemeral loopback HTTP server, test exact Origin/Host/authentication, CORS preflight, malformed/oversized requests, busy rejection, and cancellation of an owned harmless Python sleep child. They do not install dependencies, download models, or perform GPU inference. Model generation and deployed HTTPS-to-loopback browser connectivity require separate real-machine verification.
