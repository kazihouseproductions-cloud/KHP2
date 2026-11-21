# SceneFlow Web

SceneFlow is a browser-local video editing and review workspace built with Next.js, React and TypeScript. Its three-column desktop layout follows the [Scene Flow frame in Figma](https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=28-3). See the [product requirements](../../docs/superpowers/specs/2026-11-19-sceneflow-prd.md) for the editing and review rules.

## Run locally

From this directory, install the locked dependencies and start the frontend.

```powershell
npm ci
npm run dev
```

Open [SceneFlow](http://localhost:3002). Use the same browser profile and address each time to reopen your workspace. Video files, versions, shot information, feedback and checkpoints are stored in IndexedDB. Reviewer names and notification read status use local storage.

## Try the workspace

1. Drop two videos such as `01_02.webm` and `01_01.webm` onto the empty storyboard. They appear in shot order. Drop another video of the same shot into the blank area above the parent row to create a child layer.
2. Drag a new file over a clip to see the version preview. Move the pointer toward either edge to preview an insertion. Drag an existing clip over the center of another clip to swap their positions.
3. Select a clip and open **Info** to edit its shared shot notes, inspect timing, switch versions or set a stage. To select several clips, drag from any empty part of the dotted timeline, even above or below the tracks. Ctrl-click toggles individual clips. Click the first clip and Shift-click the last to select an inclusive range in either direction. Drag any selected clip to move the selected shots together, keeping their spacing and attached children. Undo reverses the whole move.
4. Press **T**, type your feedback immediately, and press **Enter** to submit. **Shift+Enter** adds a line break. Press **V** to start recording and **V** again to submit. The browser requests microphone access the first time. Draw on the picture to pause on the frame and save a drawing.
5. Open **Project menu → Local reviewer** to switch names. Post feedback under a second name, switch back to the uploader and use the bell to open the exact feedback.
6. Use the project menu to restore a checkpoint, export the full visible timeline or export one file per selected placement. Keep the tab visible during export. Downloads use an encoder available in the browser. The browser may ask to allow multiple downloads.

## Playback and integration

The desktop editor uses a compact 75% scale and fills the browser window. The timeline occupies the lower half, with scrollable layers and space around the clip rows. The preview fits the video to the player's height and preserves its aspect ratio. For wide footage in a narrow player, zoom out to see the full frame.

The Storyboard overview shows one block per parent clip, sized to include its longest child. Selecting a child layer keeps the shot divisions visible. Color shows which parts of each shot contain footage on that layer. Unoccupied parts of each column stay neutral. Click or drag within the row to seek. Open the palette to color clips by Scene, Stage or Uploaded by. Storyboard cards have neutral borders. Each child card has a stripe in the active version uploader's color.

Click a feedback card to open the frame marked by its pin. Each card has a fixed pin-color label plus any optional labels. Draft pins and labels are gray until submission, when they take the reviewer’s color. Starting a drawing during playback pauses on one frame and adds subsequent strokes to the same feedback.

Click a project or unlocked layer name to edit it in place. Enter or clicking away saves the name. Escape cancels. To delete a layer, open its three-dot menu, choose Delete layer and confirm.

Wheel down over the timeline to pan right and wheel up to pan left. When the whole timeline fits horizontally, the wheel scrolls through the layers vertically.

The timeline uses 24 frames per second for editing and time displays. Previous and Next navigate clip starts. Picture and audio follow the topmost visible clip with source media at the playhead. Export uses browser recording, so output length can differ by approximately a frame. Mixed-size videos are fitted inside the first visible source's dimensions.

Moving any clip carries its parent and siblings together. Inserting or swapping a shot previews the whole move. A shot extends through the end of its longest placement, shifting later shots and their children when it needs room. When a child is longer than its parent cell, choose the cell length to make the visible range adjustable with Slip, or use the full source duration. With the Slip Tool active, drag the footage left inside the cell to see a later part of the source, or right to see an earlier part. Faded dashed outlines show the unused footage on either side. Release to save the change as one undo step. The cell stays in place. If several parents match a filename, the importer lets you choose the parent. Drop one file at a time to create versions on an existing clip.

Rearrange returns selected shots to their parent filename order. Selecting a child includes its whole shot, even if its filename differs from the parent. The editor explains when a move needs more space, or when a linked clip is on a locked layer. A blocked operation leaves the timeline intact.

This frontend uses local reviewer identities. Shared accounts, role enforcement, notifications between devices, KHP tasks and NAS-hosted media belong to the backend integration. A fresh browser profile starts with an empty timeline.

Exit returns to the referring KHP page when its origin matches `NEXT_PUBLIC_KHP_URL` (default `http://localhost:3000`). Opening SceneFlow directly gives you a local project screen on exit.

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

For a production-mode local preview, run `npm start` after building.

The regression suite was verified with Node.js 24.
