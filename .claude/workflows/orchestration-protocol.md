# Orchestration Protocol

## Pipeline Execution Order

Pipeline adapts to task size. Size the task first (see `primary-workflow.md`).

```
XS:  [Code] → [Typecheck]
S:   [Code] → [Review ×1] → [Typecheck]
M:   [Spec-light] → [Plan] → [Code] → [Review ×1-2] → [Test]
L:   [Spec] → [Plan] → [Code] → [Review ×2] → [Test] → [Docs]
XL:  [RFC] → [Spec] → [Plan] → [Code] → [Review ×2-3] → [Test] → [Docs]
```

---

## Subagent Dispatch Rules

### Sequential Chaining (Default)

Use for the main pipeline — each phase depends on the previous:

```
planner (plan) → fullstack-developer (code) → code-reviewer (review) → tester (test)
```

- Each agent completes fully before the next begins
- Pass spec reference and plan context between agents
- If any agent reports failure, fix and re-run that phase before continuing

### Parallel Execution

Use ONLY when tasks are truly independent:

- **Research phase**: Multiple `researcher` agents for different topics
- **Review rounds**: Can run 2 `code-reviewer` agents on different files simultaneously
- **Multi-package changes**: Separate agents for frontend vs backend (only if no shared interfaces)

**Rules for parallel execution:**

- Ensure NO file conflicts between parallel agents
- Plan integration points BEFORE spawning parallel agents
- Each agent must have clear file ownership boundaries

### Review Orchestration

Review rounds scale with task size (see `primary-workflow.md` Phase 5):

```
XS:  No review agent needed
S:   Round 1: code-reviewer → focused review
M:   Round 1-2: code-reviewer → spec + standards
L:   Round 1-2: code-reviewer → full review
XL:  Round 1-3: code-reviewer (Round 3 = fresh context cross-validation)
```

- Rounds are SEQUENTIAL — each round depends on fixes from previous
- Pass the spec path to every review agent (M/L/XL)
- Review prompt must include: correctness, security, standards

---

## Agent Responsibilities

| Agent                 | Role                                 | When to Use                         |
| --------------------- | ------------------------------------ | ----------------------------------- |
| `planner`             | Create implementation plan from spec | Phase 3: after spec approval        |
| `researcher`          | Technical research, docs exploration | Phase 3: during planning (parallel) |
| `fullstack-developer` | Implement code per plan              | Phase 4: after plan approval        |
| `code-reviewer`       | Review against spec + standards      | Phase 5: 2-3 rounds mandatory       |
| `tester`              | Run tests, analyze results           | Phase 6: after reviews pass         |
| `debugger`            | Investigate bugs, produce diagnosis  | Bug reports only                    |
| `docs-manager`        | Update docs in `./docs`              | Phase 7: if architecture changes    |
| `project-manager`     | Track progress, update plans         | Status reviews                      |

---

## Context Passing Between Agents

Every agent dispatch MUST include:

1. **Spec reference**: `plans/{plan-dir}/spec.md`
2. **Plan reference**: `plans/{plan-dir}/plan.md`
3. **Code standards**: `docs/code-standards.md`
4. **Surgery edit rule**: Remind every agent — Edit tool only, no file rewrites
5. **Scope boundary**: Exactly which files this agent owns

---

## Failure Recovery

| Failure                  | Action                                           |
| ------------------------ | ------------------------------------------------ |
| Review finds issues      | Fix → re-review (don't skip to testing)          |
| Tests fail               | Fix root cause → re-review fix → re-test         |
| Compile error after edit | Fix immediately before any other work            |
| Spec becomes outdated    | Update spec FIRST → then continue implementation |
| Plan needs adjustment    | Update plan → get user approval → continue       |
