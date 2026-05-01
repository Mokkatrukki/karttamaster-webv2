---
name: ominaisuus
description: Spec-Driven Development skill for planning new features before implementation. Use this skill whenever the user says /ominaisuus, /uusi-tehtävä, "uusi ominaisuus", "lisätään feature", "tehdään X featureksi", "suunnitellaan X", or wants to plan what to build before writing code. Always generates a structured spec for user review BEFORE any implementation begins. Critical: implementation must never start without explicit user approval of the spec.
---

# Ominaisuus — Spec-Driven Development

This skill guides a feature from idea to approved spec, then to tests and tasks — in that order. Implementation happens only after the user explicitly approves the spec.

## Why this order matters

AI agents tend to jump to implementation. This skill exists to resist that. A reviewed spec surfaces scope creep, missing constraints, and wrong assumptions before any code is written. The spec also becomes the source of truth for what tests to write.

## Phase 1: Context Scan

Before asking anything, run the bundled scanner script to get a compact project snapshot (~300 tokens). This gives you the stack, modules, exports, test coverage, and pending todos — everything needed to ask smart questions.

```bash
bash <skill-dir>/scripts/scan_project.sh .
```

Where `<skill-dir>` is the directory containing this SKILL.md. Run from the project root.

Read the output. From it, extract:
- Tech stack and constraints (e.g. no React, jsdom tests, Leaflet)
- Existing modules and class patterns (e.g. DriveMode, MarkerManager as classes; bearing.ts as pure functions)
- What's already tested vs pending todos (todos = existing spec roadmap, don't duplicate)
- Testing pattern: pure function tests go in `.test.ts`, behavior specs in `.spec.ts`

If the scanner fails (not a TS project, no src/, etc.), fall back to: `find . -name "*.ts" -not -path "*/node_modules/*" | head -30` and `cat package.json`.

## Phase 2: Targeted Clarifying Questions

Ask 2–3 questions maximum. Make them specific to what you actually couldn't determine from the codebase. Don't ask about things the code already answers.

Good question: "Pitäisikö merkin siirtäminen päivittää bearing automaattisesti, vai säilytetäänkö alkuperäinen?"
Bad question: "Mitä haluaisit tämän ominaisuuden tekevän?"

If the feature request is already detailed enough that you can infer everything from context, skip questions and go straight to spec generation.

Present questions clearly and wait for answers before continuing.

## Phase 2.5: ASCII Layout (UI features only)

**Trigger:** run this phase if the feature touches any visible UI component — toolbar, bottom bar, modal, panel, dropdown, overlay, progress bar, picker, or any new screen element. Skip if the feature is purely logic/data with no new UI surface.

Before writing the spec, present 2–3 ASCII layout alternatives showing how the UI could look. This surfaces layout assumptions early — before spec language locks them in. The user's layout choice becomes a constraint in the spec.

### How to draw the alternatives

Use box-drawing characters. Show realistic content, not placeholders. Label each option with a letter and a one-line tradeoff summary.

Each option must show **both** a mobile (~40 chars wide) and desktop (~80 chars wide) variant side by side or stacked. Mobile and desktop can differ significantly — a bottom bar on mobile might become a sidebar on desktop.

**Example format:**

```
**A — [name]**
Mobile (~375px):
┌──────────────────────────────────────┐
│ [actual content, not "content here"] │
└──────────────────────────────────────┘

Desktop (~1200px):
┌──────────────────────────────────────────────────────────────────────────────┐
│ [sidebar or wider layout]                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
Tradeoff: compact mobile but wastes space on desktop.

**B — [name]**
...
```

After presenting alternatives, write exactly:

> **Kumpi layout? (A/B/C tai ehdota muutos)**

Then stop. Do not write the spec until the user picks a layout. If they suggest a hybrid or modification, sketch the updated ASCII and confirm before continuing.

When proceeding to Phase 3, incorporate the chosen layout as a specific constraint: *"UI follows layout B: ..."*

## Phase 3: Generate Spec

Build the spec from the feature request + codebase context + user answers. Use this exact format:

```
## SPEC: [Feature Name]

**OUTCOMES** — what the user can do after this is built:
- [concrete user-facing behavior]

**OUT OF SCOPE** — explicitly excluded to prevent scope creep:
- [what we're NOT building]

**CONSTRAINTS** — technical or UX limits that bound the solution:
- [existing code constraints, mobile/browser limits, performance]

**ASSUMPTIONS** — things we're treating as true without verifying:
- [dependencies, user behaviors, env facts]

**VERIFICATION CRITERIA** — testable behaviors (will become spec tests):
- [ ] [specific, falsifiable behavior]
- [ ] [edge case]
- [ ] [negative case — what should NOT happen]
```

After presenting the spec, write exactly this line:

> **Hyväksytkö tämän specsin? Muutoksia?**

Then stop. Do not generate tests, tasks, or code until the user responds.

## Phase 4: Approval Gate

Wait for explicit approval. Accept:
- "kyllä" / "joo" / "ok" / "hyväksytty" → proceed
- Modifications → update spec, show again, wait again
- "ei" / rejection → discuss and revise

Never interpret silence or a new question as approval.

## Phase 5: Generate Spec Tests

After approval, generate `it.todo()` tests from the VERIFICATION CRITERIA. Each criterion becomes one or more todos. Use the project's existing spec file naming pattern (e.g. `tests/[feature-name].spec.ts`).

Tests that can be written as pure function tests (no DOM, no Leaflet): write them fully implemented, not just as todos. Pure function tests run fast and don't need a browser.

Tests that require DOM or map interactions: write as `it.todo()` with a comment explaining what to verify manually.

Show the test file content in a code block. Ask if the user wants you to write the file, or if they want to adjust first.

## Phase 6: Task Breakdown

After tests are approved, generate an ordered task list derived from the spec (not from implementation guesswork):

```
TASKS: [Feature Name]

1. [First atomic change — typically the pure logic layer]
2. [Integration layer]
3. [UI/event wiring]
4. [Manual verification steps from spec]
```

Each task should be small enough to complete and verify in isolation. Reference which VERIFICATION CRITERIA each task satisfies.

## Phase 7: Implement

Only now start implementing, task by task. After each task, run `npm test` to verify nothing broke. Reference the spec throughout — if an implementation decision conflicts with the spec, raise it rather than silently deviating.

## Tone

This skill operates in whatever communication mode is active (e.g. caveman mode if set). Spec content itself (the formatted spec block) is always written in clear Finnish or English regardless of mode, since it's a document for review.
