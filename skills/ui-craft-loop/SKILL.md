---
name: ui-craft-loop
description: Build usable, cohesive UI without generic AI slop—separate visual direction from code implementation, anchor to the project's design system, design all UI states, and verify via accessibility interfaces plus visual checks. Use when creating or overhauling screens, components, or visual polish.
---

# UI Craft Loop

Avoid jumping straight from a vague prompt into unreviewed markup. Separate design decisions from implementation and verify both interaction and visuals.

## 1. Decide Visual Direction Before Coding
- Check if the project already has a design system, tokens, or component library—**extend and reuse it** rather than inventing parallel styles.
- When starting from scratch or fixing an unusable screen, define layout hierarchy, typography, spacing scale, and key interactions first:
  - Use image generation or rough visual mockups only for **mood, hierarchy, and visual direction**—never blindly hardcode hallucinated pixel grids, unreadable copy, or impossible controls from a raster mockup.
  - Prefer quick interactive prototypes built with real design tokens when exploring layout and interaction details.

## 2. Design Every State Up Front
Before implementing, account for:
- Empty / zero-data state
- Loading / pending state
- Error / recovery state
- Worst-case content (long names, narrow viewports, missing optional fields, large counts)

## 3. Build for Accessibility by Default
- Use native semantic elements (`button`, `a`, `label`, `dialog`, headings in order) before reaching for custom ARIA.
- Ensure every interactive element has an accessible name, visible focus state, and full keyboard operability.

## 4. Dual Verification Loop
Verify finished UI on two axes:
1. **Functional / Accessibility:** Drive the UI through accessibility interfaces (ARIA roles/labels, keyboard flow, Playwright/Testing Library queries, or OS accessibility tree) to prove it actually works for users.
2. **Visual:** Inspect rendered output at desktop and mobile widths to catch overlap, truncation, alignment, and contrast bugs that accessibility trees cannot see.
