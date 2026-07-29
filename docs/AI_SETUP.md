# AI Setup

Open **Settings** and scroll to **AI**. FocusLog works without a configured provider.

1. Select a privacy mode. Use **Local only** for Ollama or LM Studio and no cloud fallback.
2. Add a named provider profile, endpoint, optional credential, and model ID. The credential is sent directly to Windows protected storage.
3. Save, then select **Test connection**. Successful discovery returns current provider models; choose one as the generation model.
4. For a cloud provider, choose Cloud or Hybrid mode and explicitly select **Allow cloud data**. This consent is required before any cloud execution.
5. Use **Analyze today** for the first implemented analysis flow.
6. Configure optional per-level schedules for daily, weekly, monthly, quarterly, and yearly analyses. Each schedule stores a local run time, timezone, provider profile, model policy, optional fallback chain, privacy mode, catch-up limit, per-run micro-unit cost cap, and a schedule kill switch.

Ollama normally runs at `http://127.0.0.1:11434`; LM Studio normally exposes an OpenAI-compatible server at `http://127.0.0.1:1234/v1`. Android devices cannot use desktop loopback addresses; mobile AI setup and verification commands are documented separately in `docs/AI_MOBILE_ARCHITECTURE.md` and `docs/AI_MOBILE_COMMANDS.md` where that platform is present.

# AI setup

Configure provider profiles and their per-profile concurrency in the desktop AI settings. FocusLog enforces a bounded main-process global concurrency limit and validates profile limits from 1 through 32. Cloud jobs with an active budget cap require an enforceable price estimate; local Ollama and LM Studio jobs use the documented zero-cost policy.

Scheduled analyses are enqueue-only. If FocusLog was closed at the scheduled time, the next startup evaluates missed closed periods and queues catch-up work up to the configured limit. Use Analyze Now for explicit open-period analysis or regeneration.

The AI settings screen also provides per-level result inspection. Use the level tabs to review current and stale versions, queue status, provider/model disclosure, fallback use, token counts, exact micro-USD cost values, and source provenance. Cancel and retry buttons appear only for queue states where those actions are valid.

Embedding namespace lifecycle, semantic search, hybrid retrieval, facts, graph inspection, and derived-memory controls are surfaced through the AI Memory experience. Configure an embedding model on a provider profile before building a namespace. Local privacy mode requires a local embedding provider; cloud embeddings require Cloud or Hybrid mode plus explicit consent for that profile.

## Migration and reliability recovery

FocusLog refuses to open a database whose recorded schema version is newer than the application understands. Install a newer FocusLog build before opening that database; the app does not attempt a downgrade or destructive compatibility rewrite.

Before destructive or high-risk maintenance, create an encrypted backup and keep the passphrase separate from the archive. Backup/export writing uses an atomic temporary file and a disk-space preflight so low-space conditions fail before replacing a valid archive. Restore validates decryption and staging integrity before replacing live data.

If initialization is interrupted during a migration, restart FocusLog. Applied migration versions are recorded transactionally; an interrupted version is not treated as complete, and initialization can retry without duplicating tables, indexes, columns, jobs, or diagnostics.

If AI-derived data becomes corrupt, use the derived-memory rebuild/repair controls. Embedding namespaces, facts, graph relations, queue diagnostics, Playground runs, and budget reservations can be reconciled or rebuilt from canonical logs and versioned results. Canonical FocusLog check-ins remain authoritative and are not removed by derived-data repair.

## Phase 5-C provider and performance certification setup

Live provider certification never reads credentials from committed files. Configure only the providers you intentionally want to smoke test in the current shell, then run the compiled certification runner:

```powershell
pnpm --filter @focuslog/desktop build:main
$env:FOCUSLOG_PHASE5C_LIVE='1'
$env:FOCUSLOG_LIVE_OLLAMA_MODEL='your-local-model'
$env:FOCUSLOG_LIVE_OPENAI_API_KEY='your-approved-key'
$env:FOCUSLOG_LIVE_OPENAI_MODEL='your-approved-model'
node apps/desktop/dist-electron/ai/phase5-provider-performance-runner.js
```

Use equivalent variables for Anthropic, Gemini, OpenRouter, LM Studio, or a generic OpenAI-compatible endpoint. Omit unapproved providers; they will be recorded as explicitly untested. To run the release-like performance gate, add `--performance --release-like`. Artifacts are written under `artifacts/phase5/` and are redacted by construction.

# Desktop AI packaging and release gates

Phase 5-D desktop release verification uses the existing Windows desktop packaging architecture:

- `pnpm --filter @focuslog/desktop package:win` builds the renderer/main bundles, rebuilds the native encrypted SQLite dependency for Electron, and creates the NSIS installer.
- `.github/workflows/windows-desktop.yml` performs the Windows installer smoke by building, installing silently, checking the uninstaller, and uninstalling.
- `.github/workflows/desktop-ai-release-gates.yml` separates fast PR checks, nightly certification, and release-candidate packaging/live-smoke gates.
- Live provider certification is opt-in, protected-secret only, and is not available to untrusted pull requests.

Release artifacts must not ship test credentials, benchmark datasets, debug logs, source maps, temporary exports, or fixtures. The desktop package includes only built renderer output, built Electron main output, prompts, and `package.json`.
