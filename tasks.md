# The Last Harness — High-level Tasks

## Status

| Phase | Task | Status |
|-------|------|--------|
| 0 | Scaffold monorepo, providers, contracts, CLI doctor | done |
| 1 | harness-core: loop, tools, state, hooks, context | done |
| 2 | Multi-model Supervisor-Worker + cost ledger | done |
| 3 | Pipeline product-develop + HITL | done |
| 4 | Next.js dashboard | done |
| 5 | MCP bridge, Docker sandbox, unreal-cpp vertical | done |
| 6 | Compaction, span eval, MicroVM stub, Ralph loop | done |
| 7 | Demo mode + Settings page (no .env) | done |
| 8 | Runtime hardening (JSON store, MCP/policy wiring, guards) | done |
| 9 | Obsidian memory vault (semantic + episodic cross-run) | done |

## Memory (Obsidian)

- Vault default: `.harness/vault/` (Obsidian-compatible markdown)
- Settings: `memory.kind` / `vaultPath` / `projectId` / `hydrateLimit`
- External vault → writes only under `Harness/<projectId>/`
- Tools: `memory_search`, `memory_write` (ontology sync on semantic+entityId)
- UI: `/memory` + Settings → Memory

## Architecture checklist (from PDF)

- [x] MicroVM / sandbox adapter (Docker now, Firecracker path stubbed)
- [x] Default-deny egress policy (`--network none` in Docker)
- [x] Workspace-scoped mounts (CoW/MicroVM path documented for Linux/WSL2)
- [x] MCP resolve/contextualize/annotate
- [x] Ontology tool validation (Zod)
- [x] Span-level eval (`eval/span-eval.ts`)
- [x] Loop token/timeout limits (anti-ZombAI)

## Pipeline phases

1. GENERATE_PRD
2. AWAIT_PRD_APPROVAL
3. PARALLEL_TECH_DOCS
4. GENERATE_SPEC
5. VALIDATE_SPEC (dual validators × N rounds)
6. PLAN_SPRINTS
7. AWAIT_SPRINT_APPROVAL
8. EXECUTE_SPRINTS
9. DONE / FAILED

## Commands

```bash
pnpm install
pnpm doctor
pnpm harness -- run
pnpm dev:web
# Keys opcionais: http://localhost:3100/settings
pnpm exec tsx eval/span-eval.ts .harness/runs/<runId>/spans/spans.jsonl
```
