---
name: shipit
description: >-
  Commit and push the current work to main (which auto-deploys), as clean
  logical commits with good messages that REFERENCE the spec doc(s) in
  docs/specs/ for each feature/addition/fix. Then watch the deploy and mark the
  shipped specs Shipped (status + commit hash). Use when the user says "ship it",
  "/shipit", "commit and push", or "deploy".
---

# shipit

Ship the working tree to production: logical commits → push to `main` →
auto-deploy → update specs. Pushing to `main` deploys to GitHub Pages, so treat
this as a release, not a checkpoint. Only run when the user explicitly asks
(invoking `/shipit` *is* that explicit ask).

## 1. Survey

- `git status --short` and `git diff` (+ `git diff --staged`) — know exactly
  what changed.
- `git log --oneline -5` — match the house style of recent messages.
- `ls docs/specs/` — these are the spec docs you'll reference. A change usually
  ships alongside its spec (the spec file is often part of the diff).

## 2. Group into logical commits

Split the changes into **one commit per feature / addition / fix** — never one
giant mixed commit. Group by intent:
- Each spec in `docs/specs/` ↔ the code that implements it = one commit.
- Pure tooling / process / docs changes = their own commit.
- A bug fix = its own commit.

Stage each group explicitly with `git add <paths>` (not `git add -A`).

## 3. Commit message (this is the point)

For every commit write:
- **Subject**: imperative, ~50 chars, capitalised, no trailing period
  (e.g. `Add card grading`, `Fix sleeved-card sell guard`).
- **Body**: what changed and *why*, wrapped ~72 cols. Mention notable decisions
  or deviations.
- **Spec reference** (required when one exists): a line
  `Spec: docs/specs/<file>.md`. If the change implements/extends a spec, cite it.
  If it's a bug fix tied to a spec'd feature, cite that spec. If genuinely no
  spec applies (trivial tooling), say so briefly (e.g. `No spec — dev tooling.`)
  rather than omitting silently.
- **Trailer**: end with the Claude Code co-author line
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

Use a heredoc so the body/trailer format cleanly:
```
git commit -F - <<'EOF'
Add card grading

Submit a card for grading (fee + parallel wait queue); grade is driven by
centering (fixed at pull) and condition (preserved by sleeve time). Consumes
a copy and returns a sellable slab.

Spec: docs/specs/2026-06-08-grading.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

## 4. Push + deploy

- Push to `main`: `git push origin main` (the project's documented deploy flow —
  every push to main auto-deploys via GitHub Actions). Do not branch; this repo
  releases from main.
- Watch it: `gh run watch <id> --exit-status` (gh is at `~/.local/bin/gh`; add it
  to PATH). Confirm the deploy succeeds; if it fails, surface the log and stop.

## 5. Update the specs that just shipped

For each spec whose feature you just pushed:
- Set frontmatter `status:` → **Shipped**.
- Fill the **Changelog** with the real commit hash + a one-line summary.
- Update the status in `docs/specs/README.md`.

Commit that bookkeeping (`Mark <feature> spec shipped (<hash>)`, with the
co-author trailer) and push it too.

## 6. Report

Tell the user: each commit (hash + subject), the spec each references, deploy
status, and the live URL (https://finnstevens.github.io/pokenet/).

## Notes
- Honor CLAUDE.md hard constraints — never add dependencies; Bun only.
- If the working tree is clean, say so and stop — nothing to ship.
- If something is only half-built or tests are failing, do NOT ship it; report
  the state and let the user decide.
