# SceneBlock installation lifecycle plan v1.0.0

Approved: existing detection / install-update / repair / uninstall / old-version cleanup with concrete preview and retained Codex/Claude logins.
Target web2.12.1, connector2.9.0. Preserve previous packages and installed PC state during development.

- T1 generic lifecycle manager: canonicalroot boundary, reparse refusal, ownership manifest/hash and legacy fingerprints, running-version refusal, stale-plan revalidation, typed removal/result data, fixture-only tests.
- T2 native UI4actions + listdetectedversions/registeredversion/status. Confirmation lists actual files, registration and preservedunknownitems; cancel/Esc/X no mutation. Install latest then validate/register; cleanup separate explicitchoice. Foreign URL association never overwritten/deleted.
- T3 installed management entry/relaunch from temp for self-removal if necessary. Windows uninstall entry can invoke manager; downloaded setup retained. Runtime/unknown/modified content preservation must be reported honestly, no recursive wildcard deletion.
- T4 isolated workspace tests actual fixture files+injected registry; payload/native preview+dialog actions; frontend download and documentation updates.
- T5 review deletion boundaries, package sourceparity/cumulativebuild/fileinventory. No actual installation/registrychange/AIcalls/deployment.

Safety: exact allowlisted files/ownedversion folders; never shell-built deletion; reparsepoint/root-parent/sibling/currentexternalCLI paths refused. Running detection failures block instead of guessing. Old versions lacking strong ownership evidence stay for review; never delete all folders by version-shaped name alone.
