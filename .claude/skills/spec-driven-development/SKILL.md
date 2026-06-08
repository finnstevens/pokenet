---
name: spec-driven-development
description: >-
  Spec-driven development workflow for POKÉPACK. For any non-trivial build,
  feature, or change in this repo: interview the user for specifics, write a
  markdown spec (docs/specs/YYYY-MM-DD-slug.md), research + self-test the best
  approach and find gaps, then build and verify. Use BY DEFAULT for build tasks,
  or when the user types /spec. Skip only for truly trivial one-liners (typo,
  rename, copy tweak) unless the user asks for a spec.
---

# Spec-driven development

Every non-trivial change in this repo flows through a written spec the user
approves before any code is written. The spec is a living document: it captures
the interview, the research, the plan, and — after the build — the verified
results.

## When to run this

- **By default** for any feature, behavior change, refactor, or non-trivial fix.
- **Always** when the user types `/spec` (optionally with a task description).
- **Skip** only for truly trivial edits (a typo, a copy tweak, a one-line
  rename) — and even then, mention you're skipping the spec so the user can
  override. If unsure whether something is trivial, run the flow.

There are **two approval gates**. Do not cross a gate without the user's
explicit approval. Never start writing implementation code before Gate 2.

---

## Phase 1 — Interview

Goal: understand exactly what the user wants before designing anything. Ask
focused, high-leverage questions — prefer the `AskUserQuestion` tool for
choices, plain text for open-ended specifics. Cover, as relevant:

- **Problem / motivation** — what's wrong or missing, and why now.
- **Desired behavior** — concretely, what should happen from the user's POV.
- **Scope & non-goals** — what's explicitly in and out.
- **UX / UI** — where it lives (which tab/subtab), what it looks like, copy.
- **Data & state** — new store state, persistence keys, cache, economy effects.
- **Edge cases** — empty states, limits, conflicts with existing features.
- **Acceptance criteria** — how we'll both know it's done and correct.

Don't over-interview. 2–5 well-chosen questions beats twenty. Ask follow-ups
only where the answer genuinely changes the design. When you have enough, move on.

## Phase 2 — Write the spec → **GATE 1**

1. Get today's date: `date +%F` (do not guess; do not use a cached date).
2. Pick a specific kebab-case slug. Path: `docs/specs/<date>-<slug>.md`. If that
   file already exists (another spec same day), make the slug more specific or
   append `-2`.
3. Copy `spec-template.md` (in this skill's folder) and fill **everything
   through the "Gate 1" line**: summary, motivation, goals, non-goals,
   requirements, UX, data/state, acceptance criteria, open questions. Leave the
   research/plan and results sections as template stubs for now. Set
   `status: Draft`.
4. Add a row to `docs/specs/README.md` (the index).
5. Present the spec to the user (summarize key points; link the file). **Stop and
   ask for approval.** Incorporate edits until they approve.

On approval: set `status: Approved`.

## Phase 3 — Research, self-test, find gaps → **GATE 2**

Now figure out the *best* way to build it, and prove the approach before
committing to it. Fill the spec's research/plan sections:

- **Read the relevant code** — the modules you'll touch (see CLAUDE.md
  architecture map). Note exactly what exists and how data flows.
- **Research externals** — if it touches the card API, pricing, or any external
  behavior, verify your assumptions empirically (a Bun `.mjs` harness, a real
  `loadSet` call, inspecting actual API fields). Don't assume — check.
- **Find gaps & risks** — caching/`CACHE_PREFIX` bumps, persistence/migration,
  performance, conflicts with selling/sealed/achievements, edge cases the
  interview missed. List them, and either resolve them or flag for the user.
- **Decide the approach** — chosen design + alternatives considered + why.
- **Implementation plan** — concrete steps and the files each touches.
- **Test strategy** — exactly how you'll verify (per CLAUDE.md "Verify without a
  browser": `node --check`, import-graph check, Bun logic harness, headless
  Brave over DevTools, screenshots). Define what "passing" means here.

If research surfaces something that changes scope or contradicts the spec, go
back and update the spec (and re-confirm with the user if it's material).

Present the research + plan + test strategy. **Stop and ask for approval.**

On approval: set `status: Approved` → proceed.

## Phase 4 — Build

Implement per the approved plan. Match surrounding code style (vanilla JS, ES
modules, zero deps, the store pub/sub pattern). Honor all hard constraints in
CLAUDE.md (Bun only, no packages, static site). If you must deviate from the
plan, note why in the spec's Results section.

When code is written, set `status: Built`.

## Phase 5 — Test & verify

Run the test strategy you defined. Capture real output (command output,
harness results, screenshots) into the spec's **Results & verification**
section. If something fails, fix it and re-test — don't report success on a
red result. Note any deviations from the plan and any follow-ups.

When verification passes, set `status: Verified` and tell the user it's ready.

## Phase 6 — Ship (only when asked)

Per CLAUDE.md, commit + push only when the user asks. When they do: branch if
needed, commit, push, watch the deploy (`gh run watch`). Reference the spec file
in the commit body. After it's live, set `status: Shipped` and add the commit
hash(es) to the spec's changelog.

---

## Status lifecycle

`Draft` → `Approved` (Gate 1 passed) → `Approved` (Gate 2 passed) → `Built`
→ `Verified` → `Shipped`. Keep the frontmatter `status` and the README index in
sync as you progress.

## Notes

- One spec per change. Keep them tight and concrete — they're design docs, not
  essays.
- The spec is the source of truth for the change; if reality diverges, update
  the spec rather than letting it rot.
- This skill governs *how* we build; CLAUDE.md governs *what the codebase is*.
  Read both.
