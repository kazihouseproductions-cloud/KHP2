# Figma Workspace UI Implementation Plan

**Goal:** Match the sidebar and board shell to Figma file Q9zWEwG11gRksGM0w9kfRa, node 232:2765.

**Architecture:** Retain the existing Next.js, React, Tailwind, and Zustand components. Update the shared shell styles and compose the downloaded Figma icons in the existing navigation and utility components. Keep the live board content and routes.

**Design:** The supplied selection defines a gray, borderless 222px sidebar, a separate Workspace heading, 39px navigation rows with 8px gaps, purple selection, plain gray breadcrumbs, a white dotted canvas, a purple outlined account pill with chat, and a blue outlined Apps launcher. Use locally hosted Inter. Adapt to narrow and short viewports.

**Global constraints:** Reuse existing board interactions and local data; download Figma assets locally; preserve SVG root dimensions; read the installed Next.js guides; do not add dependencies.

## Tasks

- [x] Update sidebar hierarchy, exact local assets, font, breadcrumbs, and utility controls.
- [x] Match desktop shell spacing, surfaces, and responsive behavior in globals.css.
- [x] Verify lint, TypeScript, production build, desktop/mobile rendering, navigation, utility panels, and existing pin creation flow.

## Review focus

- Correct active navigation on root and tool routes.
- Breadcrumbs and account controls do not overlap at narrow widths.
- Every sidebar entry remains reachable on short screens.
- Apps and chat panels dismiss with Escape and return focus to their triggers.
- Board pins and add dialogs remain reachable with the new shell.

Styling changes are verified visually and through the project's existing checks; no test framework is added for this reversible UI update.

## Verification

`npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. Browser checks covered desktop at 1920px and 1440px, mobile at 390px and 320px, sidebar scrolling to Members, active navigation, Apps links, Escape dismissal and trigger focus, nested board breadcrumbs, and opening/canceling the add-pin form without saving test data. All visible shell images loaded at their intended dimensions. Independent read-only review found no open actionable issues after correcting account-pill spacing.
