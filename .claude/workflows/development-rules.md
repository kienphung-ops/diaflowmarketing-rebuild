# Development Rules

**IMPORTANT:** You ALWAYS follow these principles: **YAGNI (You Aren't Gonna Need It) - KISS (Keep It Simple, Stupid) - DRY (Don't Repeat Yourself)**
**IMPORTANT:** Size the task first (XS/S/M/L/XL), then follow the pipeline for that size. See `primary-workflow.md`.

---

## Surgery Edit Rule

```
✓ Use Edit tool — targeted, minimal diffs (DEFAULT)
✓ Change ONLY what's needed for the task
✓ Preserve existing formatting, comments, structure
✓ Write tool OK for NEW files
✓ Write tool OK when file needs fundamental restructuring (wrong pattern/approach)
  — document reason in commit message

✗ NEVER reformat code you didn't change
✗ NEVER add comments/docstrings/types to unchanged code
✗ NEVER restructure imports or variable order in untouched sections
```

**Why:** Surgical edits are safer, reviewable, and token-efficient. But sometimes a rewrite is the right call — don't patch a fundamentally broken file when rewriting is cleaner.

---

## Spec-First Rule (M/L/XL only)

- **M**: Light spec — acceptance criteria inline in plan
- **L/XL**: Full spec document before code
- Spec defines acceptance criteria, API contracts, UI behavior, edge cases
- **Spec is the source of truth** — code follows spec
- If implementation deviates, update spec FIRST, then code
- **XS/S tasks**: No spec needed — the task description is the spec

---

## Review Rule (scales with size)

- **XS**: No review — typecheck is sufficient
- **S**: 1 round of `code-reviewer` — focused on correctness + security
- **M**: 1-2 rounds — spec compliance + standards
- **L**: 2 rounds — full review protocol
- **XL**: 2-3 rounds — including cross-validation with fresh context agent
- **All review issues must be fixed** — no "will fix later"
- See `primary-workflow.md` Phase 5 for full protocol

### Security Review (after code review, before testing)

- **Triggered when** touching: auth, tokens, user input, API endpoints, DB queries, payments, crypto, CORS/CSP, admin paths
- **M**: OWASP Top 10 checklist against changed files
- **L**: Full `security-compliance` skill assessment → populate tech spec §14
- **XL**: Full assessment + lightweight threat model + compliance gap check
- See `primary-workflow.md` Phase 5.5 for full protocol

---

## General Rules

- **File Naming**: kebab-case with descriptive names. Long names are fine — self-documenting for LLM tools (Grep, Glob).
- **File Size**: Keep code files under 300 lines
  - Split large files into focused components/modules
  - Use composition over inheritance
  - Extract utilities into separate modules
- **No Simulation**: Never mock, fake, or simulate implementations. Write real code.
- **No Enhanced Files**: Update existing files directly. Never create "v2" or "enhanced" copies.
- **[IMPORTANT]** Follow `./docs/code-standards.md` during ALL implementation.

---

## Code Quality

- **Lint check after every file edit:**
  ```bash
  yarn lint
  ```
- Prioritize functionality and readability over strict style formatting
- Use try-catch error handling, cover security standards
- No syntax errors — code must build cleanly at all times

---

## Pre-commit/Push Rules

- Run `yarn lint` before commit
- Run `yarn build` before push (catches all errors)
- Run `yarn test` before push — **DO NOT ignore failed tests**
- Keep commits focused on actual code changes
- **DO NOT** commit confidential info (.env, API keys, credentials)
- Clean commit messages — conventional commit format, no AI references

---

## Tool Usage

- Use `docs-seeker` skill for exploring latest docs of plugins/packages
- Use `gh` bash command for Github interactions
- Use `psql` bash command for Postgres debugging
- Use `ai-multimodal` skill for describing images, videos, documents
- Use `sequential-thinking` and `debugging` skills for complex analysis
