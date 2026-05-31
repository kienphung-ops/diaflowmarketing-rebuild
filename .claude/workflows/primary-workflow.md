# Primary Workflow

**IMPORTANT:** Every task is sized first. The pipeline adapts to the task size.
**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.

---

## Task Sizing (MANDATORY FIRST STEP)

Before starting ANY work, classify the task:

| Size                  | Examples                                      | Pipeline                                                                           |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| **XS** (hotfix)       | Typo, 1-line fix, import fix, config tweak    | Code → Typecheck → Done                                                            |
| **S** (bug fix)       | Component fix, error handling, style fix      | Code → 1 Review → Typecheck → Done                                                 |
| **M** (small feature) | New component, API endpoint, refactor         | Spec (light) → Plan → Code → 1-2 Reviews → Security\* → Test → Changelog           |
| **L** (feature)       | Multi-file feature, new module, integration   | Spec → Plan → Code → 2 Reviews → Security → Test → Docs → Changelog                |
| **XL** (epic)         | Architecture change, new system, multi-module | RFC → Spec → Plan → Code → 2-3 Reviews → Security+Threat → Test → Docs → Changelog |

### Sizing Guidelines

- **XS/S**: Fix is obvious, no design decisions needed, localized change
- **M**: Requires some design thinking, touches 2-5 files, self-contained
- **L**: Crosses module boundaries, new APIs, needs spec alignment
- **XL**: Impacts architecture, multiple stakeholders, needs RFC debate

### Surgery Edit Rule by Size

- **XS/S/M**: Use Edit tool for surgical changes. Write tool allowed ONLY for new files.
- **L/XL**: Use Edit tool by default. Write tool allowed when a file needs fundamental restructuring (e.g., wrong pattern, rewrite is cleaner than patching). Document why in commit message.

---

## Pipeline Overview

```
[Size?] → XS: Code → Typecheck
        → S:  Code → Review(1) → Typecheck
        → M:  Spec(light) → Plan → Code → Review(1-2) → Security* → Test → Changelog
        → L:  Spec → Plan → Code → Review(2) → Security → Test → Docs → Changelog
        → XL: RFC → Spec → Plan → Code → Review(2-3) → Security+ThreatModel → Test → Full Docs → Changelog

* Security review conditional — triggered when touching auth, payments, user data, APIs, DB
```

---

## Phase 1: RFC (Request for Change) — XL Only

**When:** Task is XL — ambiguous, has multiple valid approaches, or impacts architecture.

1. Create RFC document in `plans/{plan-dir}/rfc.md`
2. RFC must contain:
   - **Problem statement** — what problem are we solving
   - **Proposed approaches** (2-3 options with trade-offs)
   - **Recommendation** with rationale
   - **Impact analysis** — what existing code is affected
3. Spawn **2 reviewer subagents in parallel** to debate the RFC:
   - Agent A: advocate for the recommendation
   - Agent B: challenge the recommendation, propose alternatives
4. Synthesize debate findings, update RFC with final decision
5. **Gate:** User must approve RFC before proceeding to Spec

---

## Phase 2: Spec (Specification) — M/L/XL

**Skip for XS/S tasks.** Required for M (light version), L, and XL.

### Light Spec (Size M)

Brief inline spec — can be in the plan file itself, no separate document needed:

- What's being built (1-2 sentences)
- Acceptance criteria (3-5 bullet points)
- Out of scope (if ambiguous)

### Full Spec (Size L/XL)

1. Create technical spec using the template: `.claude/skills/planning/references/technical-spec-template.md`
2. **Location:**
   - **L tasks:** `docs/features/{feature-name}/{feature-name}-technical-spec.md`
   - **XL tasks:** Same location + additional docs (see `documentation-management.md`)
3. Spec must include (at minimum — use Section Selection Guide for full list):
   - **Overview** — problem statement, goals, prerequisites, scope (in/out)
   - **Architecture** — component diagrams, role/state definitions
   - **Edge cases** — scenario/behavior table
   - **API Reference** — endpoints table + request/response examples (if applicable)
   - **Code Changes Summary** — new files, modified files, breaking changes
   - **Testing Strategy** — unit/integration/E2E test cases
   - **Security Assessment** — risk matrix (if auth/data/API feature)
   - **File Index** — backend/frontend file listings
4. **Reference example:** `docs/features/rbac/rbac-technical-spec.md`
5. **Review the spec** — spawn `code-reviewer` agent to review spec for completeness and gaps
6. **Gate:** User must approve spec before proceeding

### Spec Maintenance Rule

- **Spec must stay up-to-date** throughout implementation
- If implementation deviates from spec, update spec FIRST, then continue coding
- Spec is the source of truth — code follows spec, not the other way around

---

## Phase 3: Implementation Plan — M/L/XL

**Skip for XS/S tasks.**

### Size M

- Plan can be a simple numbered list of steps (no separate plan file needed)
- Include which files to modify

### Size L/XL

1. Delegate to `planner` agent to create implementation plan based on approved spec
2. When planning, use `researcher` agents in parallel to research technical topics
3. Plan must reference:
   - Approved spec document
   - Exact files to modify (no new files unless necessary)
   - Phase breakdown with dependencies
4. Save plan in `plans/{plan-dir}/plan.md` with phase files
5. **Review the plan** — spawn `code-reviewer` agent to validate plan against spec

---

## Phase 4: Code Implementation

### Surgery Edit Rule (CRITICAL)

```
✓ ALWAYS use Edit tool for targeted, surgical modifications
✓ Change only what's needed — minimal diff
✓ Preserve existing code structure and formatting

✗ NEVER rewrite entire files
✗ NEVER use Write tool on existing files (unless creating new file)
✗ NEVER reformat/restructure code you didn't change
✗ NEVER add comments, docstrings, or type annotations to unchanged code
```

**Why:** Full file rewrites destroy existing work, introduce bugs, and waste tokens. Surgery edits are safer, reviewable, and efficient.

### Implementation Rules

- Follow `./docs/code-standards.md` strictly
- Follow the approved plan step by step
- After EACH file modification, run compile/typecheck to catch errors immediately:
  ```bash
  yarn lint
  ```
- **DO NOT** create new enhanced/refactored files — update existing files directly
- **DO NOT** simulate or mock implementations — write real code
- **DO NOT** add features beyond what the spec defines

---

## Phase 5: Review

Review depth scales with task size:

| Size   | Review Rounds | Reviewer                                                          |
| ------ | ------------- | ----------------------------------------------------------------- |
| **XS** | None          | Self-verify (typecheck passes)                                    |
| **S**  | 1 round       | `code-reviewer` agent — focused review                            |
| **M**  | 1-2 rounds    | `code-reviewer` agent — spec + standards                          |
| **L**  | 2 rounds      | `code-reviewer` agent — full review                               |
| **XL** | 2-3 rounds    | `code-reviewer` agents — including fresh-context cross-validation |

### Review Prompt (Size S)

```
Review the following changes. Focus on: correctness, security, no regressions.
```

### Review Prompt (Size M/L/XL)

```
Review the following changes against spec: plans/{plan-dir}/spec.md

Focus areas:
1. Does implementation match ALL acceptance criteria in spec?
2. Code standards compliance (docs/code-standards.md)
3. Security vulnerabilities
4. Edge cases — are they handled?
5. Performance concerns

List EVERY issue found. Be strict. Do not approve if issues remain.
```

- Fix ALL issues found in each round
- Run next round to verify fixes + catch new issues

### Cross-validation Review (XL only)

Spawn a DIFFERENT `code-reviewer` agent (fresh context) to review:

- Final implementation against spec
- Verify no regression from previous fix rounds
- Check integration points with existing code

### Review Exit Criteria

- [ ] No security issues
- [ ] No compile/type errors
- [ ] Code follows `docs/code-standards.md`
- [ ] Acceptance criteria met (M/L/XL only)

**Gate:** Only proceed to security review (if triggered) or testing when review rounds pass clean.

---

## Phase 5.5: Security Review — Conditional

**Triggered when** the feature touches any of these areas:

- Authentication or authorization code
- Token/session management
- User input handling or API endpoints
- Database queries or schema changes
- File system operations
- External API integrations
- Payment or financial code
- Cryptographic operations
- CORS, CSP, or security headers
- Admin/privileged access paths

### Security Review by Size

| Size     | Security Review                                            |
| -------- | ---------------------------------------------------------- |
| **XS/S** | Skip unless touching auth/payment code                     |
| **M**    | Lightweight — OWASP Top 10 checklist against changed files |
| **L**    | Full — `security-compliance` skill assessment              |
| **XL**   | Full + threat model + compliance gap check                 |

### Lightweight Security Review (M)

Run against changed files only. Check for:

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated and sanitized
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (no `dangerouslySetInnerHTML`, escaped output)
- [ ] CSRF protection on state-changing endpoints
- [ ] Auth checks on all protected endpoints
- [ ] Error messages don't leak internal details
- [ ] Rate limiting on public endpoints

### Full Security Review (L/XL)

Use `security-compliance` skill. Assess these domains:

**1. Access Control**

- RBAC/permission enforcement correct for new endpoints
- Least privilege applied — no over-permissioned roles
- Admin endpoints protected with proper role checks

**2. Data Security**

- Sensitive data encrypted at rest and in transit
- PII/PHI handled per data classification policy
- Secrets managed via environment variables (not code)
- No sensitive data in logs or error responses

**3. API Security**

- Input validation on all endpoints (schema-based)
- Rate limiting configured
- CORS restricted to allowed origins (not `*` in production)
- Security headers present (CSP, HSTS, X-Frame-Options)
- JWT validation (expiry, signature, token_version)

**4. Session/Token Security**

- Token expiry appropriate (access: short, refresh: medium)
- Server-side session revocation works
- Token rotation prevents replay attacks
- Logout invalidates all tokens

**5. Database Security**

- Parameterized queries only (no string concatenation)
- New tables/columns have appropriate constraints
- Cascade deletes won't cause unintended data loss
- Migration is reversible with documented rollback

### Threat Model (XL only)

For XL tasks, produce a lightweight threat model:

```
1. What are we protecting? (assets, data)
2. Who might attack it? (threat actors)
3. How might they attack? (attack vectors)
4. What controls prevent it? (mitigations)
5. What residual risk remains? (accepted risks)
```

Document in the technical spec under Section 14 (Security Assessment).

### Security Review Output

Findings go into the technical spec's Security Assessment section (§14):

- **§14.1 Risks Mitigated** — what this implementation fixes
- **§14.2 Remaining Risks** — what's still open + mitigation plan
- **§14.3 Compliance Gaps** — if applicable (SOC 2, GDPR, etc.)
- **§14.4 Recommendations** — follow-up security improvements

### Security Review Exit Criteria

- [ ] No CRITICAL findings (blocks merge)
- [ ] No HIGH findings without documented mitigation plan
- [ ] OWASP Top 10 checklist passed for changed code
- [ ] Secrets scan clean (no hardcoded credentials)
- [ ] Technical spec §14 updated with security assessment

**Gate:** Only proceed to testing when security review passes.

---

## Phase 6: Testing — M/L/XL

**XS/S: Lint only** (`yarn lint`). No test agent needed.

**M/L/XL:**

1. Delegate to `tester` agent to run full test suite
2. Test requirements:
   - All existing tests must still pass (no regressions)
   - New functionality should have tests where applicable
   - **DO NOT** use fake data, mocks, or tricks to pass tests
3. If tests fail:
   - Fix the root cause (not the test)
   - Re-run review (Round 1 at minimum) on the fix
   - Re-run tests
   - Repeat until all tests pass
4. Run compile checks one final time:
   ```bash
   yarn lint && yarn build
   ```

---

## Phase 7: Documentation & Changelog

Documentation scales with task size:

| Size   | Documentation Required                                          |
| ------ | --------------------------------------------------------------- |
| **XS** | None                                                            |
| **S**  | None (commit message is sufficient)                             |
| **M**  | Changelog entry                                                 |
| **L**  | Feature docs (essential files only) + Changelog                 |
| **XL** | Full feature docs (all 8 files) + Changelog + Architecture sync |

### Feature Docs — Size L

Create `docs/features/{feature-name}/` with:

- `{feature-name}-technical-spec.md` — created during Spec phase, updated during implementation
- `summary.md` — what was built, deviations, lessons learned

### Feature Docs — Size XL

Create `docs/features/{feature-name}/` with:

- `{feature-name}-technical-spec.md` — full spec (created during Spec phase)
- `summary.md` — implementation summary
- `user-guide.md` — end-user documentation
- `design.md` — UI/UX spec (if UI-heavy feature)

See `.claude/workflows/documentation-management.md` for details.

### Changelog (Size M/L/XL)

1. Add entry to `docs/changelogs/CHANGELOG.md` under `[Unreleased]`
2. Category: Added / Changed / Fixed / Removed
3. Include brief description and issue/PR reference

### Architecture Sync (Size L/XL — if applicable)

1. Verify spec is still accurate — update if deviated
2. If feature changes architecture, API contracts, or module boundaries:
   - Delegate to `docs-manager` agent to update `docs/codebase-summary.md`, `docs/system-architecture.md`
3. Update plan status to completed

---

## Completion Checklists (by size)

### XS Checklist

- [ ] Code change is correct
- [ ] Typecheck passes

### S Checklist

- [ ] Code change is correct
- [ ] 1 review round passed
- [ ] Typecheck passes

### M Checklist

- [ ] Light spec / acceptance criteria defined
- [ ] Implementation follows plan
- [ ] 1-2 review rounds passed
- [ ] Security review passed (if touching auth/API/data/payments)
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Changelog updated

### L Checklist

- [ ] Technical spec exists: `docs/features/{name}/{name}-technical-spec.md`
- [ ] Spec is up-to-date with final implementation
- [ ] Implementation follows approved plan
- [ ] 2 review rounds passed (all clean)
- [ ] Security review passed (OWASP checklist + `security-compliance` skill)
- [ ] Tech spec §14 (Security Assessment) completed
- [ ] All tests pass
- [ ] Typecheck passes with zero errors
- [ ] `summary.md` written
- [ ] Changelog updated
- [ ] Architecture docs updated (if applicable)

### XL Checklist

- [ ] RFC approved
- [ ] Technical spec exists: `docs/features/{name}/{name}-technical-spec.md`
- [ ] Spec is up-to-date with final implementation
- [ ] Implementation follows approved plan
- [ ] 2-3 review rounds passed (including cross-validation)
- [ ] Security review passed + threat model documented
- [ ] Tech spec §14 (Security Assessment) completed with compliance gaps
- [ ] All tests pass (no mocks, no tricks)
- [ ] Typecheck passes with zero errors
- [ ] `summary.md` + `user-guide.md` written
- [ ] Changelog updated
- [ ] Architecture docs updated

---

## Debugging Workflow (Bug Reports)

1. Delegate to `debugger` agent to investigate and produce diagnosis report
2. Create mini-spec for the fix (acceptance criteria + root cause)
3. Implement fix using surgery edits
4. Review fix (1-2 rounds via `code-reviewer`)
5. Run tests via `tester` agent
6. If tests fail, repeat from step 3
