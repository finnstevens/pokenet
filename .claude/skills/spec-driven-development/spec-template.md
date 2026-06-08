---
title: <Human-readable change title>
date: <YYYY-MM-DD>
slug: <kebab-case-slug>
status: Draft   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# <Change title>

> One-sentence summary of the change.

## Motivation / problem
<What's wrong or missing today, and why this is worth doing now.>

## Goals
- <Concrete, observable outcome 1>
- <Concrete, observable outcome 2>

## Non-goals / out of scope
- <Explicitly not doing X>

## Requirements & behavior
<What should happen, from the user's point of view. Be concrete. Numbered or
bulleted functional requirements.>

## UX / UI
<Where it lives (tab/subtab), what it looks like, copy/labels, states.>

## Data & state
<New store state, persistence keys, cache keys / CACHE_PREFIX bumps, economy
effects, migrations. "None" if not applicable.>

## Acceptance criteria
- [ ] <Testable condition 1>
- [ ] <Testable condition 2>

## Open questions
- <Anything unresolved for the user>

<!-- ───────────────────────── GATE 1: spec approved above ───────────────────────── -->

## Research & findings
<What the relevant code does today (files + data flow). Empirical checks run and
their results (API fields, prices, harness output). Precedents in the repo.>

## Gaps & risks
- <Risk / edge case / migration / cache concern — and how it's handled.>

## Approach & alternatives
<Chosen design and why. Alternatives considered and why rejected.>

## Implementation plan
1. <Step — file(s) touched>
2. <Step — file(s) touched>

## Test strategy
<Exactly how this will be verified: node --check, import-graph check, Bun logic
harness, headless Brave / DevTools, screenshots. What "passing" means.>

<!-- ─────────────────────── GATE 2: research & plan approved above ─────────────────────── -->

## Results & verification
<Filled after building. What was actually built, deviations from the plan, and
the real test output / screenshots proving it works.>

## Changelog
- <commit hash> — <message>
