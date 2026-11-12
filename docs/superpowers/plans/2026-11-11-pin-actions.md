# Pin Actions Implementation Plan

**Goal:** Reveal a pin options button on hover/focus and provide Add Member, Members, Edit, and Delete actions.

**Design:** Extend the existing circular pin without nesting controls inside its navigation link. Show a compact menu and a members panel that expands left when space permits, with a sample roster and searchable assignments. Reuse the pin form for editing. Delete first asks “Are you sure?” and then requires exact uppercase `DELETE`; both steps explain that nested pins and their tasks are included.

**Architecture:** Keep the current React, Zustand, localStorage, modal, glyph, and styling conventions. Optional persisted member IDs preserve compatibility with existing records. Read the latest stored pin before mutations; cascade deletion through descendants and their tasks. Render popovers in the browser top layer so board scrolling does not clip them. Support keyboard and touch access.

- [x] Add meaningful tests for edit/member persistence, stale changes, exact delete confirmation, cascade scope, and storage failures.
- [x] Implement data mutations and sample member directory.
- [x] Build the options menu, members panels, edit form, and two-step deletion dialog.
- [x] Verify tests, lint, types, build, desktop/mobile interaction, and focus/dismissal behavior.

Figma inspection: the API identified selection 210:541, “Members panel — expands left,” then reached its plan limit. Browser inspection found the Pin main component hidden. Use the existing rendered pin style and the user's explicit interaction requirements; exact updated component asset extraction is unavailable.

## Verification

Ten Node tests pass for persistence, stale edits, exact confirmation, descendant/task deletion scope, unrelated records, and storage failure rollback. Lint, typecheck, and production build pass. Browser verification used sample pins on a separate production preview origin, covering assignment and edit persistence across reload, search, keyboard menu access, Tab/Shift+Tab/Escape, both delete steps and exact uppercase gating, cancellation, and member panels fitting 390px and 320px widths. The final browser delete was canceled; actual deletion is exercised against isolated in-memory storage in the tests.

Independent review identified modal focus restoration happening before the native dialog had closed. Browser reproduction confirmed body focus after cancellation. Focus now restores on the next animation frame, to the trigger if it survives or to board-main after deletion; the browser confirmed focus returned to the trigger after assignment, editing, and cancellation.
