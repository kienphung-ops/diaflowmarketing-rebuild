# Project Documentation Management

---

## Feature Documentation

Documentation scales with task size (see `primary-workflow.md`):

| Size     | Docs Required                                                               |
| -------- | --------------------------------------------------------------------------- |
| **XS/S** | None — commit message is sufficient                                         |
| **M**    | Technical spec (light, in plan dir) + Changelog                             |
| **L**    | Technical spec (full) + supporting docs (essential) + Changelog           |
| **XL**   | Technical spec (full) + all supporting docs + Changelog + Architecture sync |

### Technical Spec (Primary Feature Document)

**Every M/L/XL feature** produces a technical spec as the **master document** — the single source of truth.

- **Template:** `.claude/skills/planning/references/technical-spec-template.md`
- **Reference example:** `docs/features/rbac/rbac-technical-spec.md`
- **Location (M):** `plans/{plan-dir}/spec.md`
- **Location (L/XL):** `docs/features/{feature-name}/{feature-name}-technical-spec.md`

For **L/XL tasks**, create a documentation directory **before implementation starts** and complete it **when implementation finishes**.

### Supporting Documents (Extracted from Tech Spec)

After the technical spec is written, **extract focused supporting documents** from it. Each supporting doc targets a specific audience or concern — easier to navigate than one massive spec.

**Relationship:** Tech spec is the master. Supporting docs extract and expand from it. If content conflicts, tech spec wins. Update tech spec first, then sync supporting docs.

### Structure

```
docs/features/{feature-name}/
├── {feature-name}-technical-spec.md  # Master document (source of truth)
├── brd.md              # Business Requirements — extracted from §1 (Overview)
├── design.md           # UI/UX design spec — extracted from §12 (Frontend)
├── solution.md         # Technical solution — extracted from §3 (Architecture)
├── api-spec.md         # API contracts — extracted from §8-9 (API Reference)
├── testcase.md         # Test cases — extracted from §13 (Testing Strategy)
├── migration.md        # Database migration — extracted from §2, §5 (Schema, Migration)
├── summary.md          # Implementation summary (written AFTER implementation)
└── user-guide.md       # End-user documentation (written AFTER implementation)
```

### Which Supporting Docs to Create by Size

| Size   | Required Supporting Docs |
|--------|--------------------------|
| **M**  | None — tech spec only |
| **L**  | `brd.md`, `solution.md`, `api-spec.md`, `testcase.md`, `summary.md` + `design.md` (if UI), `migration.md` (if DB) |
| **XL** | All 7 supporting docs |

### Document Contents

#### `brd.md` — Business Requirements Document

**When:** Created BEFORE implementation (during Spec phase)

```markdown
# {Feature Name} — Business Requirements

## Problem Statement

What problem does this feature solve? Why does it matter?

## User Stories

- As a [role], I want [action] so that [benefit]

## Acceptance Criteria

- [ ] Measurable, testable conditions
- [ ] Edge cases explicitly listed

## Scope

### In Scope

- What this feature includes

### Out of Scope

- What this feature does NOT include

## Dependencies

- Other features/modules this depends on

## Priority

- P0 (critical) / P1 (high) / P2 (medium) / P3 (low)
```

#### `design.md` — UI/UX Design Specification

**When:** Created BEFORE implementation

```markdown
# {Feature Name} — Design Spec

## Screen States

- Default / Loading / Empty / Error / Success states

## Wireframes

- Layout description or links to design-reference/ assets

## Responsive Behavior

- Phone (375px): ...
- Tablet (768px): ...
- Desktop (1280px): ...

## Interactions

- User actions and transitions
- Animation descriptions

## Design Tokens Used

- Colors, spacing, typography from design-tokens.js

## Accessibility

- Touch targets, contrast, screen reader considerations
```

#### `solution.md` — Technical Solution & Architecture

**When:** Created BEFORE implementation (during Plan phase)

```markdown
# {Feature Name} — Technical Solution

## Architecture

- Component diagram / data flow

## Packages Affected

- Which packages are modified and why

## New Components

- List of new components (with location: core-uikit or feature-module)

## API Endpoints

- New or modified endpoints

## State Management

- Context changes, new TanStack Query hooks

## Database Changes

- New tables, columns, migrations (if any)

## Trade-offs

- Why this approach over alternatives
```

#### `api-spec.md` — API Contracts

**When:** Created BEFORE implementation

```markdown
# {Feature Name} — API Specification

## Endpoints

### POST /api/v1/{resource}

**Request:**
{json schema}

**Response:**
{json schema}

**Error Responses:**

- 400: validation errors
- 401: unauthorized
- 404: not found

## Data Models

- Pydantic schemas / TypeScript interfaces
```

#### `testcase.md` — Test Cases

**When:** Created BEFORE implementation, updated AFTER

```markdown
# {Feature Name} — Test Cases

## Unit Tests

- [ ] Test case 1: description → expected result
- [ ] Test case 2: description → expected result

## Integration Tests

- [ ] API endpoint returns correct data
- [ ] Database operations are atomic

## UI Tests

- [ ] Screen renders correctly on all viewports
- [ ] Form validation shows proper errors
- [ ] Loading/empty/error states display correctly

## Edge Cases

- [ ] Empty data handling
- [ ] Network failure recovery
- [ ] Concurrent access
```

#### `migration.md` — Database & Data Migration

**When:** Created when feature involves DB changes

```markdown
# {Feature Name} — Migration

## Schema Changes

- New tables / columns / indexes

## Migration Script

- Alembic migration reference

## Data Migration

- Existing data transformation needed?

## Rollback Plan

- How to reverse if something goes wrong
```

#### `summary.md` — Implementation Summary

**When:** Created AFTER implementation is complete

```markdown
# {Feature Name} — Implementation Summary

## What Was Built

- Brief description of delivered functionality

## Files Changed

- List of modified/created files

## Deviations from Plan

- What changed from original spec and why

## Known Limitations

- What's not perfect, tech debt introduced

## Lessons Learned

- What went well, what to improve next time

## Metrics

- Lines of code, test coverage, performance impact
```

#### `user-guide.md` — End-User Documentation

**When:** Created AFTER implementation is complete

```markdown
# {Feature Name} — User Guide

## Overview

- What this feature does (user perspective)

## Getting Started

- Step-by-step usage instructions

## Screenshots

- Key screens with annotations (link to design-reference/)

## FAQ

- Common questions and answers

## Troubleshooting

- Known issues and workarounds
```

### Feature Documentation Lifecycle

```
Brainstorming Phase:
  → Define requirements, scope, edge cases
  → Output feeds directly into technical spec

Spec Phase (BEFORE code):
  → Create docs/features/{feature-name}/
  → Write: {feature-name}-technical-spec.md (using template)
  → Include all relevant sections per Section Selection Guide

Implementation Phase:
  → Update technical spec if architecture/API changes
  → Spec is source of truth — deviation requires spec update FIRST

Completion Phase (AFTER code):
  → Write: summary.md (L/XL), user-guide.md (XL only)
  → Update: technical spec with "Implementation Status" section
  → Update: changelog
```

### Feature Documentation Checklist

Before declaring a feature complete:

- [ ] Technical spec exists (`{feature-name}-technical-spec.md`)
- [ ] Spec includes: Overview, Architecture, Edge Cases, Code Changes, Testing Strategy
- [ ] Spec includes: API Reference (if feature has API)
- [ ] Spec includes: DB Schema + Migration (if DB changes)
- [ ] Spec includes: Security Assessment (if auth/data/API feature)
- [ ] Spec includes: File Index (backend + frontend paths)
- [ ] Spec includes: Function Call Chain Map (L/XL — maps UI → Hook → API → Endpoint per action)
- [ ] Spec matches final implementation (updated during dev if deviated)
- [ ] `summary.md` written with deviations and lessons (L/XL)
- [ ] `user-guide.md` written with usage instructions (XL only)
- [ ] Changelog updated

### Why Function Reference Matters

The function call chain map (§15.2 in tech spec template) acts as **persistent memory** for AI agents and developers. When someone needs to modify a feature months later, they can:

1. Read the tech spec to understand _what_ the feature does
2. Read §15.2 to find _exactly which files and functions_ to touch
3. Follow the call chain to understand cross-layer dependencies

**Reference example:** `docs/features/pages-feature-brd/10-frontend-function-reference.md` — maps every pages action through UI → Hook → Redux → API → Endpoint.

---

## Changelog Management

### Structure

```
docs/changelogs/
├── CHANGELOG.md           # Master changelog (all versions)
├── v0.1.0.md              # Per-version detailed changelog
├── v0.2.0.md
└── ...
```

### Master Changelog Format (`CHANGELOG.md`)

```markdown
# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Feature X — brief description (#issue)

### Changed

- Updated Y to support Z (#issue)

### Fixed

- Bug in W causing Q (#issue)

### Removed

- Deprecated feature V

---

## [0.2.0] — 2026-04-16

### Added

- ...
```

### Per-Version Changelog Format (`v0.x.0.md`)

```markdown
# Release v0.2.0

**Date:** 2026-04-16
**Status:** Released

## Summary

One paragraph overview of this release.

## Features

- **Feature Name** — description
  - Docs: `docs/features/{feature-name}/`
  - PR: #123

## Bug Fixes

- **Fix description** — what was wrong, what was fixed
  - Affected: file/module
  - Severity: critical/high/medium/low

## Breaking Changes

- Description of what breaks and migration path

## Migration Guide

- Steps to upgrade from previous version

## Contributors

- @username — contribution description
```

### Changelog Update Triggers

| Event             | Action                                                               |
| ----------------- | -------------------------------------------------------------------- |
| Feature completed | Add to `[Unreleased]` → Added                                        |
| Bug fixed         | Add to `[Unreleased]` → Fixed                                        |
| Breaking change   | Add to `[Unreleased]` → Changed + migration note                     |
| Release cut       | Move `[Unreleased]` items to new version section, create `vX.Y.Z.md` |
| Dependency update | Add to `[Unreleased]` → Changed                                      |
| Feature removed   | Add to `[Unreleased]` → Removed                                      |

---

## Project-Level Documentation

### Core Documents (`docs/`)

| Document                  | Purpose                                      | Update Frequency          |
| ------------------------- | -------------------------------------------- | ------------------------- |
| `codebase-summary.md`     | Architecture overview, tech stack, structure | When architecture changes |
| `code-standards.md`       | Coding rules, patterns, review checklist     | When standards evolve     |
| `system-architecture.md`  | System design, data flow, infra              | When architecture changes |
| `project-overview-pdr.md` | Product requirements                         | When scope changes        |

### Automatic Updates Required

- **After feature implementation**: Update changelog, create feature docs
- **After major milestones**: Review roadmap, update architecture docs
- **After bug fixes**: Document in changelog with severity
- **After security updates**: Record in changelog, update security section
- **After release**: Create version changelog, archive unreleased items

### Update Protocol

1. **Before updates**: Read current doc status
2. **During updates**: Maintain version consistency, proper formatting
3. **After updates**: Verify links, dates, cross-references
4. **Quality check**: Ensure updates match actual implementation

---

## Plans

### Plan Location

Save plans in `./plans` directory with timestamp and descriptive name.

**Format:** Use naming pattern from `## Naming` section injected by hooks.

**Example:** `plans/260416-2350-authentication-implementation/`

### File Organization

```
plans/
├── 260416-2350-feature-name/
│   ├── research/
│   │   └── researcher-XX-report.md
│   ├── reports/
│   │   ├── scout-report.md
│   │   └── reviewer-report.md
│   ├── plan.md                           # Overview (< 80 lines)
│   ├── phase-01-setup.md
│   ├── phase-02-implement-backend.md
│   ├── phase-03-implement-frontend.md
│   └── phase-04-testing.md
└── ...
```

### Overview Plan (`plan.md`)

- Keep generic and under 80 lines
- List each phase with status/progress
- Link to detailed phase files
- Key dependencies

### Phase Files (`phase-XX-name.md`)

Each phase file contains:

- **Context Links** — related reports, files, documentation
- **Overview** — priority, status, brief description
- **Key Insights** — findings from research
- **Requirements** — functional + non-functional
- **Architecture** — system design, component interactions
- **Related Code Files** — files to modify/create/delete
- **Implementation Steps** — detailed, numbered
- **Todo List** — checkbox tracking
- **Success Criteria** — definition of done
- **Risk Assessment** — potential issues + mitigation
- **Security Considerations** — auth, data protection
- **Next Steps** — dependencies, follow-up tasks
