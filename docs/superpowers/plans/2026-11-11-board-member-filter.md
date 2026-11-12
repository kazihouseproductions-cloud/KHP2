# Board member filter

Implement Figma selection 250:477: a 299px member-search card below the account toolbar, with a rounded white surface, gray search input, member rows, and a separate pill to view the selected member's tasks. Figma API calls are rate-limited; the selection was inspected in the editor.

Use the existing sample roster and avatar styles. Selecting one member grays out every pin without that direct assignment, including ancestor pins. Preserve board positions and click targets. Clearing or reselecting the active member restores all pins. Maintain the selection across board navigation and update matching immediately after assignments change. Legacy pin membership follows the existing Members panel defaults.

The task pill opens a dialog of locally stored tasks assigned to that member, with links back to their section boards. Empty search and task results are explicit. On mobile, collapse the filter behind a trigger so it does not cover the board by default.

- [x] Test pin matching, legacy membership, switching/clearing, assignee matching, and assignment updates.
- [x] Add session filter state, the member-search card, task dialog, and pin dimming.
- [x] Verify tests, lint, types, production build, and desktop/mobile interaction.

Verification: 18 tests, lint, typecheck, production build, and diff whitespace checks pass. Browser measurements at 1920×940 confirm the source card at x=1586, y=124, width=299, height=258. Selecting Nadia leaves Makers at full opacity and Mayapur at grayscale/0.3 opacity; clearing and reselecting restore every pin. Selection persists into a dimmed pin's board and back, including its ancestor pin. Search/empty results, task-dialog empty state, 390px layout, automatic compact collapse, and clickable dimmed pins were verified.

Independent review identified two focus issues, both reproduced before fixes and verified afterward: clearing now focuses the search input, and closing tasks after a desktop-to-mobile resize focuses the visible compact trigger. Task dialogs also dismiss on board navigation. No workspace records were modified by the filter tests in the browser.
