# SceneBlock v2.13.0 AI previs improvement plan

Approved scope: preserve manual editing and all character appearance; improve AI intent expression, prompt refinement and tab connection recovery. User approved the preceding design and requested implementation. Existing root documentation is retained and will be updated after verification. Work only in this active development folder and root release artifacts; never the separate SceneBlock repository. Backup: dev/2026-10-25-ai-previs-v2.12.1-backup.

## Design
AI should produce an editable visual reference, with explicit core participants, count, temporal order, spatial relationships, direction and framing. Use standard existing actors unchanged. Decompose varied prose to typed actions/relations; no label keyword or sample-specific rules. Approximate fine detail using existing assets/poses and show concise notices; retain hard blocks for invalid data, genuinely unclear core targets and unsafe/unrealizable core relationships. Unknown detail must not poison an explicitly bound entity on the same source line. No automatic provider calls on editing, reconnect or resume.

## Tasks
- [x] T1: AI-only compiler/protocol extension. Generic spatial relations, timed 3D trajectories and action approximation, moving-subject/medium camera framing. Existing actor renderer/appearance remain unchanged. If a timed trajectory hook is necessary, implement as optional AI metadata with independent validation and no effect on ordinary projects. Add varied positive/negative fixtures, sampled playback/save-open assertions; run old tests.
- [x] T2: Session client. sessionStorage current-tab credential only, explicit disconnect clears, reload restores through server validation. Retry transient failures without clearing token; no automatic authorization. Longer bounded lease, visibility/pageshow/focus renewal, expired401 reconnect guidance; stale async work cannot reconnect a disconnected session. No localStorage credentials or provider login storage.
- [x] T3: Review/refinement. Input remains editable after result; editing invalidates stale apply/preview and permits explicit regeneration on the same connection. No automatic generation or lost scene. Review reports simplifications and hard failures distinctly.
- [x] T4: Regression/review/native/package. Existing manual camera, XYZ, pose/timeline/save/export tests; AI source/entity/relationship and reload/transient/expired/disconnect browser tests. Rebuild connector installer with new source, old installer preserved. No actual install/registry/delete/provider account calls/deployment. Test counts reported as mock vs actual.

## Verification and rulings
Unit tests use explicit typed fixtures across unrelated scenes; browser tests validate user actions and sampled scene positions. Actual provider quality must be reported separately and not inferred from fixtures. Review each task, record /10 stage scores and any limits. New files dated2026-10-25. Web2.13.0 and connector2.10.0. No new model/assets/library downloads.

Completed: see 2026-10-25-ai-previs-results.md and dev/2026-10-25-ai-previs-verification. All review findings addressed. Actual provider runs remain explicitly unperformed.
