# QDMP Preview Reliability

Use this runbook for `apply-host` work targeting 千岛小程序. It separates host implementation facts from developer-tool delivery facts so a preview failure does not restart brand learning.

## Required order

1. Run `qdmp-preview-handshake.mjs --host <host> --write` and import the returned `importDirectory`.
2. Confirm the configured AppID and first declared route.
3. Build once and confirm the target WXML/WXSS files contribute to `buildFingerprint`.
4. Open the project in 千岛开发者工具 and capture the actual simulator URL.
5. Run the handshake again with the simulator URL, `--compiled` and `--screenshot-captured`.
6. Accept `connected` only when `/<appId>/main/app-config.json` returns HTTP 200 and valid JSON.

## Failure routing

| Signal | Owner layer | Action | Forbidden detour |
| --- | --- | --- | --- |
| `QDMP_SIMULATOR_UNREACHABLE` | developer-tool process/session | Check that the current simulator session is alive and use its current port. | Do not rebuild the brand package. |
| `QDMP_SIMULATOR_OUTPUT_UNMOUNTED` | developer-tool/devkit static server | Restart or upgrade the developer tool, reopen the project, then reprobe. | Do not rerun `learn-brand`, rewrite host styles or treat a disk build as runtime proof. |
| `QDMP_RUNTIME_CONFIG_INVALID` | compiler/runtime contract | Inspect the returned body and current compile output. | Do not claim platform PASS from a screenshot flag. |
| AppID mismatch | project binding/config | Correct the source and compiled `project.config.json`, then restart the project session. | Hot reload is not an identity refresh. |
| Route mismatch | launch configuration | Select the frozen target route and reproduce the same URL. | Do not QA a different page. |
| Manifest 200 but visual mismatch | host implementation or runtime rendering | Continue to visual smoke QA with a fresh screenshot. | Do not close on manifest reachability alone. |

## Session-contamination regression

When a defect depends on reopening projects, one successful launch is insufficient:

1. Open the target project and require `connected`.
2. Close only the project, keeping the developer-tool process alive.
3. Reopen the same project.
4. Require a new simulator session, HTTP 200 manifest, the same AppID/route/build fingerprint, and a fresh rendered screenshot.

This proves the active output directory belongs to the current session rather than a process-global stale server.

## Time budget

- Runtime handshake: fail within 3 seconds when the simulator is reachable but the manifest is absent.
- Fast apply-host: do not spend its five-minute preview budget on learn-brand, full-host QA or repeated implementation after a platform-layer blocker.
- Certification begins only after the user accepts the first preview and explicitly requests the deeper scope.

## Known incident

`migrations/pokemon-tcg-official/host-runs/card-plugin2/preview-runtime-incident.json` records the 2026-09-15 QDMP 0.2.3 session-server failure and its verified closure on QDMP 0.5.6.
