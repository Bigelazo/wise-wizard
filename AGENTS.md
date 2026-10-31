# wise-wizard

## Conventions

### Language

Repo docs (markdown, `GLOSSARY.md`, ADRs) in Spanish. Issues, code and identifiers in English; `GLOSSARY.md` gives each term's code name.

### Features catalog

`FEATURES.md` lists what the app does for the student, grouped by the modules in `docs/ARCHITECTURE.md`, in plain non-technical language from the student's point of view. Every change that adds, changes or removes a user-facing capability updates `FEATURES.md` in the same change. Until the MVP ships, each entry carries a status (`planificada` / `implementada`); after the MVP, list only implemented capabilities.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`Bigelazo/wise-wizard`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
