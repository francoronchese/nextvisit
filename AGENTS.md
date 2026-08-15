# AGENTS.md

## Language

- Talk to the user in Spanish.
- All code, comments, and documentation are written in English, always.

## Comments

- Comments are written in English, always.
- Default to no comments: honest names and small functions make code self-documenting.
- Only comment the **why**, never the **what**. If a comment restates the code, delete it.
- When code enforces a decision from an ADR, the spec, or CONTEXT.md, reference it
  (e.g. `-- ADR-0004: attendance is a flag on ended, not a state`).
- Long declarative files may use section banner comments to orient the reader
  (schema.sql already does this with `-- ===== Enums =====`). Use sparingly.
- TODO/FIXME only for genuinely deferred work: state what is missing and why.
- Keep the comment next to the code it explains; never leave trailing (end-of-line)
  comments in code that is otherwise clean.

## Agent skills

### Issue tracker

Issues and specs for this repo live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map to `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Architecture

The repo structure, module boundaries, and key coding rules live in `ARCHITECTURE.md` at the root. Read it before contributing to the codebase.
