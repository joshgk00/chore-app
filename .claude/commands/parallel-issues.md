# Parallel Issue Implementation

Implements multiple GitHub issues simultaneously, each in an isolated git worktree. Every issue gets the full development workflow: branch creation, implementation, quality gates, code review, and PR creation — all self-contained so the main session stays untouched.

## Input

$ARGUMENTS should be a space-separated list of GitHub issue numbers.

Example: `/parallel-issues 70 71 73`

If no arguments are provided, ask the user which issues to work on.

## Workflow

### Phase 1: Fetch all issues

For each issue number, run `gh issue view <number>` to get the title and body. Validate that all issues exist and are open. Print a summary table:

| # | Title | Labels |
|---|-------|--------|

Ask the user to confirm before proceeding.

### Phase 2: Launch worktree agents

For each issue, launch an Agent with `isolation: "worktree"` and `run_in_background: true`. Use `mode: "auto"` so agents can work autonomously. Launch ALL agents in a single message for true parallelism.

Each agent gets the full prompt below, with `ISSUE_NUMBER`, `ISSUE_TITLE`, and `ISSUE_BODY` substituted.

### Phase 3: Monitor, clean up, and report

As each agent completes, immediately remove its worktree so the branch is unlocked for local checkout:

```bash
git worktree remove --force <worktree-path>
```

The worktree path is returned in the agent's completion notification. The branch and PR are already pushed to the remote, so the worktree is no longer needed.

Report each agent's results as they come in. When all are done, print a final summary table:

| # | Title | Branch | PR | Status |
|---|-------|--------|----|--------|

---

## Agent Prompt Template

Use this as the prompt for each worktree agent. Substitute the issue-specific variables.

```
You are implementing GitHub issue #ISSUE_NUMBER in an isolated git worktree. You must complete the ENTIRE workflow below — from branch creation through PR — without any help from the main session. Everything happens in this worktree.

## Issue
**#ISSUE_NUMBER: ISSUE_TITLE**

ISSUE_BODY

## Step 1: Setup

```bash
# Install dependencies (worktrees don't share node_modules)
npm install

# Create feature branch from develop
git checkout develop
git checkout -b ISSUE_NUMBER-kebab-case-summary
```

Choose a branch name following the convention: `{issue-number}-{kebab-case-summary}` based on the issue title.

## Step 2: Understand the codebase

Read the project CLAUDE.md files to understand conventions:
- Root CLAUDE.md — architecture, coding standards, testing patterns
- packages/client/CLAUDE.md — React patterns, design system, accessibility
- packages/server/CLAUDE.md — Express layers, database patterns, error handling

Explore the codebase to understand the relevant area before writing any code. Read existing files that you'll modify.

## Step 3: Implement

Follow the project conventions:
- Server: factory functions, cached prepared statements, try-catch route handlers, AppError hierarchy
- Client: TanStack Query for server state, CSS custom properties (no raw Tailwind colors), font-display/font-body, WCAG AA accessibility
- Shared: types in packages/shared, no circular dependencies
- Tests: in packages/{pkg}/tests/ mirroring src/, never colocated with source

Write tests alongside implementation. Every new module needs tests covering happy path and error cases.

## Step 4: Verify (first pass)

Run ALL of these — every one must pass:
```bash
npm run typecheck
npm run lint
npm run test -- --run
```

Fix any failures before proceeding. Do not skip this step.

## Step 5: Code quality review

Launch THREE review agents in parallel, passing them the full `git diff develop...HEAD`:

**Agent 1 — Code Reuse**: Search for existing utilities/helpers that could replace new code. Flag duplicated logic. Check for inline patterns that existing utilities handle.

**Agent 2 — Code Quality**: Check for redundant state, parameter sprawl, copy-paste with variation, leaky abstractions, stringly-typed code, unnecessary comments (WHAT not WHY).

**Agent 3 — Efficiency**: Check for unnecessary work, missed concurrency, hot-path bloat, recurring no-op updates, memory leaks, overly broad operations.

Address findings:
- Fix issues that are in scope for this PR
- Skip pre-existing issues (note them but don't fix — file change discipline)
- Skip false positives

## Step 6: Verify (second pass)

After addressing review findings, re-run verification:
```bash
npm run typecheck
npm run lint
npm run test -- --run
```

All must pass.

## Step 7: Code quality orchestrator

Run the code-quality orchestrator by launching 4 targeted review agents in parallel against the diff (`git diff develop...HEAD`):

**Agent 1 — Standards Compliance**: Check adherence to project CLAUDE.md standards — naming conventions, file organization, comment quality, design system compliance.

**Agent 2 — Security Audit**: Check for injection vulnerabilities, missing auth gating, exposed secrets, unsafe crypto, missing input validation, SQL injection risks.

**Agent 3 — Architecture Review**: Check for SOLID violations, layer skipping (routes calling db directly), circular dependencies, coupling issues, god objects.

**Agent 4 — Error Handling**: Check for missing try-catch in route handlers, swallowed errors, missing error boundaries, unsafe error messages leaking internals.

Address findings:
- Critical/High: Fix immediately
- Medium: Fix if quick and in scope
- Low: Note but defer

## Step 8: Verify (third pass)

Re-run after code quality fixes:
```bash
npm run typecheck
npm run lint
npm run test -- --run
```

All must pass.

## Step 9: Commit

Stage only files related to this issue (never `git add -A` or `git add .`).

Commit with imperative-mood message. Max 72 chars subject. No Co-Authored-By or AI references.

For multi-file changes, use a body with bullet points:
```
Add feature X for issue #N

- Implement Y in service layer
- Add Z component with polling hook
- Add tests for both layers
```

## Step 10: Push and create PR

```bash
git push -u origin HEAD
```

Create a PR targeting `develop` using `gh pr create`. The PR body must:
- Open with the problem/context (why), then what this PR does
- List specific changes with method/property names
- Include scenario-based test plan with numbered steps and "Verify that..." outcomes
- End with `Closes #ISSUE_NUMBER`
- Include reviewer checklist if applicable (API changes → unit tests, UI changes → accessibility)

Use HEREDOC for the body to preserve formatting.

## Step 11: Wait for CI

Run `gh pr checks <pr-number> --watch` to wait for CI to pass. If CI fails, fix the issue, commit, push, and re-check.

## Step 12: Handle Copilot review

Check for Copilot review comments:
```bash
gh api repos/{owner}/{repo}/pulls/{pr-number}/comments | jq '.[] | {path: .path, line: .line, body: .body}'
```

If Copilot left comments:
- Address valid feedback (fix code, update tests)
- For out-of-scope findings, reply noting they're tracked separately
- Commit and push fixes
- Wait for CI to pass again

Reply to each comment explaining what you did.

## Step 13: Report

Print a summary of what was done:
- PR URL
- Files changed with line counts
- Tests added
- Review findings addressed
- Any deferred items

## Important Rules

- NEVER modify files outside the scope of this issue
- NEVER use raw Tailwind colors — always CSS custom properties
- NEVER add comments explaining WHAT code does — only WHY
- NEVER skip verification steps
- NEVER commit secrets or .env files
- Use parameterized SQL queries (? placeholders, never string interpolation)
- Wrap Express route handlers in try-catch with next(err)
- All mutations need tests for both happy path and error cases
```

---

## Error Handling

If an agent fails:
- Report which issue failed and why
- The other agents continue independently
- Suggest the user run `/parallel-issues <failed-number>` to retry just that one
