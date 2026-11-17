# Moodboard Web

Standalone Next.js App Router application with TypeScript and Tailwind CSS, based on the [KHP Moodboard Figma frame](https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=328-671).

## Run

```powershell
cd "E:\Risun\KHP 2\apps\moodboard-web"
npm install
npm run dev
```

Open http://localhost:3001. Production uses `npm run build` followed by `npm start`.

## UI scope

The app opens in a board library with **My boards** and **Shared with me** sections. Create an empty board with **New board**, open an existing board, or search and sort the current section. **Exit to files** returns to this screen. Each board keeps its own contents and undo history while the app remains open. The included sample board contains the design's sticky note and reference-link card. Shared with me is empty until shared boards are supplied by the future backend.

Board titles default to **Untitled board**. Edit the title in the left panel and press Enter or click outside to apply it. Escape cancels the edit; a blank name returns to the default. Library cards show the updated name and a preview of the board.

The left toolbar creates sticky notes, text, images, links, to-dos, calendars, tables, collections, and comment threads. Canvas cards have square corners. The plus button in a To-Do card adds another task without replacing existing tasks. Cards support editing, moving, multi-selection, duplication, deletion, note colors, and drag rotation. Select an object, activate **Rotate**, then drag the object or its circular rotation handle. Hold Shift to snap to 15-degree angles. Each drag is one undo step.

**Image**, immediately below Text, opens the system file picker. Choose an image to attach its thumbnail to the cursor, then click the canvas to place it. Escape or choosing another tool cancels placement. Images retain their proportions and use browser object URLs; they are not uploaded. They remain available when navigating between boards and through undo/redo. Unneeded image resources are released when no board or history entry references them.

Comment components contain conversations with a username and timestamp on each message. Enter a display name, write a reply, and post it with the send button or Ctrl/Cmd+Enter. The name is editable for testing conversation UI. Long conversations scroll within the component. The people row above Layers uses sample profile photos and is labeled **Preview**; live board presence will require the backend. **Share board**, below the people row, opens a sharing preview with email and edit/view role controls. Preview invitations are marked **Not sent** and create no external sharing or access changes.

Connect creates a line by dragging from one component to another. Within 16 screen pixels of a component, the line snaps to its edge and the target is outlined. This also works when reconnecting an endpoint. Click a line to select it, drag either circular endpoint to reconnect it, or press Backspace/Delete to remove it. Drag empty canvas to select multiple components.

**Layers** controls selection, visibility, locking, and stacking. Frontmost items appear at the top. Ctrl/Cmd-click toggles individual items and Shift-click selects a contiguous range. Drag a row's grip vertically to reorder it, or drag a selected row's grip to move its selected siblings together. Alt+Up/Down on a grip also reorders a layer. Reordering stays within the current collection or the board's top level; moving a collection preserves its member order. Each reorder is one undo step.

Collections group regular components. Select several components and drag one of their headers into a collection to move the selection into it. The collapsed collection shows its title over faded previews. Click it to open an editable area on the same canvas, with an editable title, Collapse, and Unwrap controls. Drag a member outside the area to remove it from the group. Unwrap removes the collection while keeping its members and their positions. Collections cannot contain other collections.

Boards, titles, comments, and undo history stay in memory and reset on refresh. No browser or backend saving is implemented, as requested. There is no authentication, upload service, or real-time collaboration. Calendar dates use the design review date of 17 November 2026.

The Apps menu links to KHP at `http://localhost:3000`. Configure `NEXT_PUBLIC_KHP_URL` and optional `NEXT_PUBLIC_SCENEFLOW_URL` with `.env.local` using `.env.example`. SceneFlow shows “Coming soon” until configured.

The Inter font, Kazi House Productions logo, and Apps icon are copied from the existing `khp-web` assets. Other outline icons use Lucide. Figma was inspected through the browser without MCP.

Sample profile photos are local copies of these Unsplash image sources: [Maya sample](https://images.unsplash.com/photo-1494790108377-be9c29b29330), [Arif sample](https://images.unsplash.com/photo-1500648767791-00dcc994a43e), and [Nadia sample](https://images.unsplash.com/photo-1534528741775-53994a69daeb). The display names are fictional UI examples.

## Controls

- `V`: Select. Drag a card's header or the top edge of a sticky note to move it.
- `H`: Grab. Drag empty canvas to pan. Middle-button dragging also pans.
- Mouse wheel: Pan vertically. Shift + wheel: Pan horizontally. Ctrl + wheel: Zoom around the pointer, from 25% to 250%. Click the percentage control to reset to 100%.
- Drag empty canvas: Box-select components. Hold Ctrl/Cmd or Shift to add to the selection.
- Ctrl/Cmd-click in Layers: Toggle an item. Shift-click: Select a range. Drag a grip to reorder.
- `C`: Comment. Click empty canvas to add a comment card.
- `N`: Add a sticky note. `T`: Add text.
- `Delete` / `Backspace`: Delete selected unlocked components or selected connection lines.
- Arrow keys: Move the selected components by one pixel. Shift + arrow: Move by ten pixels.
- `Ctrl/Cmd+Z`: Undo. `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`: Redo.
- `Escape`: Cancel the current gesture, clear selection, and return to Select.

## Verify

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```
