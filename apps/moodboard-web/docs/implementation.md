# Moodboard UI implementation

Date: 17 November 2026

## Scope and source

Create a standalone Next.js, TypeScript, and Tailwind application in `apps/moodboard-web/`. Implement the Figma frame at https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=328-671 using the browser, as requested. The user confirmed UI only, with no backend, and requested that the second Elements row read **Link** to match the reference-link card.

The loaded 1920 × 940 frame contains a pale dotted canvas, a white left tool panel, a yellow sticky note, a reference-link card, an Elements panel on the right, a floating bottom toolbar, a circular Apps control, and the Kazi House Productions logo.

## Approach

A static rendering would match the initial screen but make its controls inert. A frontend implementation with in-memory state supports reviewing the screen and its interactions without creating a persistence or backend contract. Use the latter, within the user's UI-only scope. Refreshing resets the demonstration board. Reuse the existing local Inter font, Kazi House logo, and matching Apps icon from `khp-web`; use a packaged outline icon library for the remaining UI icons.

## Work plan

- [x] Scaffold the isolated application directory and install its own dependencies.
- [x] Implement the reference layout with responsive panels and local assets.
- [x] Implement frontend card creation/editing, selection, movement, panning, connections, visibility, locking, undo/redo, rotation, and menus.
- [x] Verify history and link safety with Node tests, run lint, typecheck, and production build, and inspect desktop and mobile views in the browser.

## Boundaries and review focus

Do not alter KHP, SceneFlow, repository reorganization, shared packages, or infrastructure. Do not add authentication, database access, browser persistence, uploads, NAS integration, or deployment. Toolbar cards beyond the two visible examples are simple UI previews. App navigation must clearly indicate an unavailable app rather than imply a working integration.

Review undo/redo after branching, locked items, connections after deletion, unsafe link protocols, keyboard focus, small screens, and the initial desktop geometry. UI styling is verified visually; focused model tests cover behavior rather than duplicate markup.

## Verification record

Forty-four Node tests cover undo/redo, branching, locking, connection cleanup, link protocols, placement after panning, mobile card sizing, wheel pan and pointer-anchored zoom, marquee and modifier selection, boundary endpoints, retargeting and connection identity, rotated hit testing, visual stacking, collection membership, movement, duplication, unwrapping, rejection of nested collections, session board isolation and naming, drag rotation, stable collection member rotation, named conversation threads, multiple to-do rows, image sizing and resource reachability, connection snapping, hierarchical layer reordering, and library ownership filters. Lint, TypeScript, and production build checks pass.

Browser checks cover note editing, visibility, locks, table creation and undo, connections and redo, moving a sticky note, moving a text card, new-card visibility after 1400 pixels of panning, calendar navigation, to-do completion, the file dialog, and the app switcher. Responsive checks use 390 × 844 portrait and 844 × 390 landscape. The sidebar scrolls in short windows, and mobile panels do not create horizontal page overflow.

A separate read-only code review identified placement after panning, the missing text-card drag handle, and sidebar clipping. All three were corrected and checked. Canvas stacking now follows Layers order, including collection members, and is independent of selection.

## Canvas interaction update

The user requested vertical wheel scrolling, Shift-wheel horizontal scrolling, Ctrl-wheel zoom, drag-to-connect, selectable and reconnectable lines, Delete/Backspace line removal, box selection, and Ctrl/Shift selection in Elements. Collection is now a real group rather than a placeholder card. The user confirmed regular components only; nested collections are rejected.

Collections open on the same canvas with a visible area, title, Collapse, and Unwrap controls. Collapsed groups show the title over faded member previews. Dragging a selection into a collection assigns its members in one undo step. Moving a collection moves its members. Dragging a member outside releases it. Unwrap preserves the members and their positions. Inherited locks prevent direct editing and movement; moving an unlocked parent collection carries its children together.

Browser checks confirm drag-to-connect, endpoint retargeting, both deletion keys while retaining cards, undoing line deletion, marquee selection, Ctrl/Shift Elements selection, dropping two cards into a group, renaming and editing members, collapse/reopen, and unwrap retaining content. A native wheel check confirmed vertical canvas movement. Automated tests cover Shift-wheel and Ctrl-wheel mathematics, zoom limits, and pointer anchoring.

Final read-only review identified rotated hit detection, target ordering under overlapping cards, and frame sizing after duplicating a member. The implementation now uses inverse-rotation point tests, matches visual layers when choosing connection targets, and refits affected collections after duplication. Regression tests cover each case. Endpoint handles use a separate overlay above component cards.

## Board library, rotation, conversations, and presence UI

The library is the initial screen. New boards start empty with the title **Untitled board**; the initial sample board retains the Figma example cards. Exit to files returns to the library. Board contents, names, and undo history are isolated per board and retained while navigating in the current app session. The user explicitly deferred saving to the backend implementation, so this update adds no persistence.

The left panel has a board-title input with Enter/blur to apply, Escape to cancel, and a default for blank titles. Rotate is now a drag tool with an on-canvas handle and Shift snapping. Both direct object dragging and handle dragging rotate around the selection center, with a single history entry on release. Collection bounds expand around rotated members without moving their centers or siblings.

Comment components support named, timestamped messages and a reply composer. Display names are editable for the UI prototype. Message bodies can be selected as text, and long threads scroll independently from canvas wheel panning. The top of Elements contains locally stored sample profile photos and status dots, marked **Preview**. Actual user identity and board presence remain backend work.

Browser verification covers the first-screen library, creation of an empty board, rename and reopen, isolated board contents, search, title cancellation and blank fallback, two named replies, direct-object and handle rotation, one-step rotation undo, scrollable long conversations without canvas movement, loaded profile images, and mobile library/title/presence layouts without horizontal overflow. A final read-only review identified the thread-wheel interception and sibling movement after collection rotation; both were reproduced and corrected.

## To-do rows, images, Layers, and sharing preview

The To-Do plus button appends independent task rows and focuses the new row. Existing completion and text remain intact. Long task lists scroll inside the card. Canvas component cards and collection previews have zero corner radius.

Connect uses a 16-screen-pixel tolerance around rotated component outlines. The preview endpoint snaps to the target boundary and the target receives a visible outline. Release and endpoint reconnection use the same tolerance.

The Image tool appears immediately below Text. It opens an image file picker, decodes the selected file locally, shows a cursor thumbnail, and places the image at the next canvas click with its aspect ratio preserved. Escape, another tool, or leaving the board cancels pending placement. Browser object URLs are retained across board navigation and undo/redo, then revoked when no board's present, past, or future state needs them. Images are not transmitted or persisted.

Elements is now Layers. Its hierarchy is listed front to back. Grip dragging and Alt+Up/Down reorder siblings, preserve the order of a selected block, keep collection members together, and support undo. Ctrl/Cmd toggles and Shift range selection use the displayed order. Rendering and connection hit tests derive stacking from the same hierarchy.

The gallery sidebar contains My boards and Shared with me with separate counts and search results. The shared section has an empty state until the backend provides received boards. Share board appears below On this board. The dialog previews email invitations and edit/view roles, explicitly marks them Not sent, and makes no external access changes.

Browser checks for this update confirm app navigation, shared empty state, multiple to-do text and completion, a connection dropped 11 pixels outside the target, vertical layer dragging, Ctrl/Shift layer selection, zero-radius computed card styles, and the sharing preview. Chrome's extension file-access permission blocked automated file selection, so complete image picker-to-placement verification remains a manual check. Model tests cover image dimensions, placement coordinates, and image references across undo branch changes. Final read-only review found and verified fixes for pending image placement overriding bottom toolbar changes, hierarchy/stacking disagreement after grouping, and unreleased image URLs after history removal.
