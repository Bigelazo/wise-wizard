# wise-wizard

## Conventions

### Language

Repo docs (markdown, `GLOSSARY.md`, ADRs) in Spanish. Issues, code and identifiers in English; `GLOSSARY.md` gives each term's code name.

### Features catalog

`FEATURES.md` lists what the app does for the student, grouped by the modules in `docs/ARCHITECTURE.md`, in plain non-technical language from the student's point of view. Every change that adds, changes or removes a user-facing capability updates `FEATURES.md` in the same change. Until the MVP ships, each entry carries a status (`planificada` / `implementada`); after the MVP, list only implemented capabilities.

### Quality gates

`bun run check` runs every CI gate except e2e; a change is done when it passes with zero findings. In Claude Code, a fallow hook audits the changed code on `git commit` and `git push` and blocks on a `fail` verdict; only findings the change introduces block. Fix them and retry.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`Bigelazo/wise-wizard`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
