# The Last Harness

Production-grade multi-model agent harness — Supervisor-Worker orchestration, schema-first contracts, HITL gates, MCP grounding, sandbox adapters, and span-level eval.

> Models propose. Architectures dispose.

## Stack

- TypeScript monorepo (pnpm)
- Vercel AI SDK + OpenRouter (Kimi, Fable, GPT/Codex, Claude, GLM, MiniMax…)
- Zod contracts · local JSON state store (portable, no native deps) · Next.js control plane
- Docker sandbox (L1) with Firecracker/MicroVM adapter stub (L3)

## Quick start (sem API keys)

O harness inicia em **demo mode** por padrão — pipeline completo offline, sem `.env`.

```bash
pnpm install
pnpm doctor
pnpm harness -- run          # usa defaults de .harness/settings.json
pnpm dev:web                 # http://localhost:3100
```

- **Configurações / API keys:** [http://localhost:3100/settings](http://localhost:3100/settings) → salva em `.harness/settings.json`
- **Memory vault:** [http://localhost:3100/memory](http://localhost:3100/memory) — Obsidian markdown em `.harness/vault/` (semantic + episodic cross-run)
- **Live mode:** cole OpenRouter (ou keys nativas) na página Configurações e mude Mode → `live`
- HITL auto-approve fica ligado em demo; em live você aprova na UI / `pnpm harness -- approve <id>`

## Memory

Working memory fica no `ContextManager` (in-process). Semantic/episodic/procedural persistem no vault Obsidian-compatible via `@harness/memory`:

```
.harness/vault/
  Semantic/   decisions.md, learnings.md, entities/
  Episodes/   YYYY-MM-DD.md, runs/<runId>.md
  Procedures/ memory-policy.md, …
  index.md
```

Override em Settings → Memory (`vaultPath` externo escreve só em `Harness/<projectId>/`). Tools do agente: `memory_search`, `memory_write`.

## Pipelines

`product-develop`:

1. GENERATE_PRD → HITL approve  
2. PARALLEL_TECH_DOCS  
3. GENERATE_SPEC → dual validators × N rounds  
4. PLAN_SPRINTS → HITL approve  
5. EXECUTE_SPRINTS (developer + validator)

Verticals: `coding`, `unreal-cpp`.

## Layout

See `tasks.md` and `providers.yaml` for roles/models. Architecture source: `pdf-Achteture.pdf`.
