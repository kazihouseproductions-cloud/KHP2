# SceneFlow Product Requirements Document

- Date: 21 November 2026
- Version: 0.41
- Status: Frontend implementation authorized on 21 November 2026. The current milestone uses browser-local media and project state. The shared backend and permission model are deferred.
- Application: `apps/sceneflow-web`

## 1. Purpose

SceneFlow gives the production team one workspace to arrange shots, review stage videos and versions, make timeline edits, and record feedback against the correct media context.

A new project starts with an empty timeline. Users upload clips by dragging and dropping them. Filenames such as `01_01` and `01_02` determine initial automatic shot ordering. Children dropped into an empty new layer match and align to their parents by filename; children dropped onto a dashed cell in an existing layer use the cell the user chose. The drop location determines whether a clip is placed in an existing layer, becomes a new version of an existing clip, or creates a new layer.

Each large storyboard card owns a shot block. Moving a parent or any child moves the whole block. Keeping a child longer than the parent video expands the block and pushes neighboring blocks as needed. Every child stays within its own block.

This draft combines the supplied Figma design, the user's toolbar and hierarchy clarifications, and the existing shared platform requirements. Proposed behavior and unresolved decisions are identified explicitly.

## 2. Sources and requirement status

| Source | Evidence and limits |
| --- | --- |
| [Figma: KHP / Scene Flow, node 28:3](https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=28-3) | Reviewed in the browser on 19 November 2026. The main frame is 1726 by 1354. The Scene Flow page also contains stage/version examples. Static drawings establish visible controls, not complete interaction rules. |
| User: editing toolbar | Delete, Undo, Redo, Split, Delete Left, Delete Right, Add Video to Right, Add Video to Left, enable/disable snap, Snap All as a magnet action, Rearrange, and Slip Tool are required. |
| User: directional deletion | Delete Left and Delete Right trim the selected video at the playhead. They do not delete all timeline clips on that side. |
| User: timeline hierarchy | Moving any member carries the parent and all siblings. Snap All closes gaps between selected shot blocks. |
| User: selected clip editing | Split and directional trims affect only the selected placement, including when it is a parent. |
| User: feedback pins | Text and voice drafts use gray markers. Submitted feedback uses the author's color. Pins appear above the corresponding clips in the reviewed design. |
| User: insertion and deletion | Add Video Left/Right creates a parent when the parent layer is selected and a child when an upper layer is selected. Deleting a parent also removes its linked children. |
| User: playback | At each playhead position, display the topmost visible layer containing video there. When its clip ends, reveal the next visible layer containing video for the remaining time. |
| User: drag-and-drop intake | Start with an empty timeline; accept dragged clips and automatically arrange them by name, such as `01_01`, `01_02`. |
| User: drop targets and layers | For incoming files, an edge or gap inserts and the center creates a version. For clips already on the timeline, a gap inserts and the center swaps. These rules also apply when a moved clip covers a dashed cell. |
| User: conditional upper-layer matching | Children match and align to parent cards by filename when dropped into an empty new layer. A drop onto a dashed cell in an existing layer takes precedence over filename matching. This clarification supersedes the earlier general matching rule. |
| User: replacement duration | When a new version has a different duration, ask whether to adopt the new duration or keep the existing timeline length. Do not silently select either outcome. |
| [Shared platform architecture, 17 November 2026](2026-11-17-shared-dotnet-platform-architecture.md) | Records shared KHP login, task integration, NAS-only video storage/delivery, and an initial five simultaneous SceneFlow users. Detailed backend/media designs are architecture proposals, not evidence of implemented services. |
| Current repository | KHP, Moodboard and SceneFlow have separate Next.js frontends. The SceneFlow frontend implements the review workspace using local project data. |

**Confirmed** means explicitly requested by the user. **Observed** means visible in Figma. **Proposed** means a recommended rule awaiting review. **Open** means the affected behavior must be decided before implementation.

## 3. Goals and boundaries

### Goals

- Preserve parent/child relationships during timeline changes.
- Make drag-and-drop intake predictable, with filename ordering and clear previews of placement, version creation, and new-layer creation.
- Provide the twelve requested editing actions with predictable results.
- Let reviewers navigate media and identify its scene, shot, stage, and version.
- Keep feedback attached to the correct version and source time.
- Preserve originals and previous versions.
- Share authorized project changes without silently losing acknowledged edits.
- Fit the shared KHP platform and NAS media constraints.

### Proposed first-release boundaries

Cover the designed review workspace, parent/child timeline, requested tools, layer creation/renaming, stage/version selection, drag-and-drop media intake, feedback, and shared persistence/integration. New projects are empty by default. An interface milestone may offer an explicitly selected sample project, but must be described as a prototype until real shared access and server persistence exist.

The menu supports full-video and selected-clip exports. Advanced effects, transitions, color grading, independent audio mixing, arbitrary nested timelines, and offline collaborative merging remain open scope decisions.

Unacceptable outcomes include linked children drifting during parent movement, edits overwriting original files, feedback silently attaching to a replacement version, and a Saved indicator appearing before durable acceptance.

## 4. Product approach

| Approach | Fit and tradeoff | Status |
| --- | --- | --- |
| Parent shot timeline with child stage clips and video editing | Matches the confirmed hierarchy, filename matching, contextual drops, and visible-layer playback. Preserves grouped edits while allowing user-created layers. | Basis for this draft. Remaining edge cases require review. |
| Independent multitrack video editor | Supports arbitrary clip placement and audio composition, but needs additional synchronization rules to preserve the requested hierarchy. | Not selected. Broader scope requires a separate decision. |
| Review-only player and shot list | Simpler to deliver, but does not satisfy the editing toolbar. | Insufficient as the complete product scope. |

Next.js is confirmed by the setup request. TypeScript, App Router, Tailwind, Biome, npm, `src/`, and local port 3002 are setup choices made for consistency with neighboring apps, not additional product requirements.

## 5. Users and permissions

These capability groups are proposed. Exact role names and grants must align with shared KHP workspace permissions.

| Capability group | Intended work |
| --- | --- |
| Viewer | Open authorized projects, play media, inspect information, and read feedback. |
| Reviewer | Add feedback and participate in review. Approval is a separate permission. |
| Editor | Add media, arrange parents/children, trim, split, delete, activate versions, and maintain metadata. |
| Project administrator | Manage access/settings and perform explicitly authorized destructive project actions. |

The server enforces project, media, editing, feedback, and approval permissions. Button visibility alone is insufficient.

## 6. Workspace and navigation

| Region | Observed design | Proposed behavior |
| --- | --- | --- |
| Header | Menu, notification bell, project name, SceneFlow label, Preload Video, Exit. | Preserve project context. Exit resolves unsaved work and returns to the originating KHP context. Preload exposes bounded scope, progress, cancellation, and failure. |
| Left panel | Activity feed with visibility, action, time, and actor filters. | Show authorized activity with actor, action, timestamp, and a link to the affected resource. Combine filters and provide reset. |
| Player | Scene/shot label, time display, uploader, image zoom, fullscreen. | Confirmed: show the topmost visible layer with video at the playhead and reveal lower visible video when upper coverage ends. Keep image zoom separate from timeline scale. |
| Toolbar | Editing beside playback controls, snapping, timeline zoom. | Provide named buttons, tooltips, disabled states, and explicit selection requirements. Playback and editing share one playhead. |
| Overview | One row with a layer selector and a color palette. | The storyboard shows one block per shot, sized by its reserved time. Child layers show the same divisions, with colored clips in their actual positions and neutral space elsewhere. Scrubbing seeks to that time. The palette offers Scene, Stage and Uploaded by, a preview and an editable color key. Stage and uploader follow the active version. |
| Timeline | Ruler, playhead, large cards, upper clips, version badges, feedback pins above upper clips, track lock/visibility controls. | Start empty. Support contextual drop zones, filename ordering/matching, and user-created layers. Parent cards have a neutral border. Each child card has a bottom stripe in its active version uploader's color. Its tooltip identifies the uploader. Text and voice drafts have gray pins. Submitted pins use the author's color. |
| Right panel | Feedbacks, Info, Edit. | Info follows the selected timeline clip and provides clip details, shot information, and version controls. |

Each child timeline card has one eye button to show or hide that placement. Hiding a child reveals the next visible clip with footage at the playhead and affects full-video export the same way. The card stays on the timeline with a crossed-out eye. Users can switch versions in Info and use the layer header for layer-wide controls.

The sticky layer names and their controls stay above scrolling clips, pins and selection overlays.

The workspace uses a 75% base scale and fills the browser viewport. The activity and inspector panels use text two display pixels larger than the base scale, with proportionally larger controls and cards. The lower timeline reserves space above and below the clips. Additional tracks scroll within the timeline. The player takes the remaining vertical space and fits video to its height by default, centered at its source aspect ratio. For wide footage in a narrow player, zooming out reveals the full frame. On narrow screens, tabs switch among the activity log, timeline and clip inspector.

### Top-bar menu

- **Checkpoints.** Automatically capture the timeline state immediately before a major change, including layer deletion and deletion of multiple clips. Let the user choose any available checkpoint and restore that state. Restoring a pre-deletion checkpoint brings back the affected layers and clips with their timing, versions, and parent links.
- **Export Full Video.** Export the full timeline as it plays with the current edits, visible layers, and active clip versions. At each timeline position, apply the same playback rules as the player, including revealing lower visible footage when an upper clip ends.
- **Export Selected Clips.** Export one separate video file for each selected timeline clip.

### Notification bell

When another user posts feedback on a clip, notify the person who uploaded that clip through the top-bar bell. Identify the feedback author and the clip in the notification, for example, “Person B left feedback on 01_02.” Clicking the notification opens that clip and the specific feedback item in the Feedbacks panel, using the version and timestamp associated with the feedback. For text and voice, posting occurs on submission. For a drawing, it occurs when the first stroke creates the feedback item.

## 7. Timeline hierarchy and invariants

### Confirmed rules

- Large cards form the parent layer. Corresponding clips above are children.
- Selecting any member for Snap All includes its shot block. Each block moves at most once.
- Delete Left/Right trim the selected video at the playhead.
- Split and directional trims edit only the selected placement. When a parent is split, an intact child stays with the original parent. If the child extends past the cut, the new right-hand parent segment starts after that child.
- Deleting a parent removes its children. Deleting a single child removes only that child.
- Add Video Left/Right creates a parent on the parent layer or a child on an upper layer according to the selected layer.
- Children imported into an empty new layer match and align to their parent cards by filename.
- A dashed-cell drop in an existing layer obeys the chosen cell, even if the filename matches another parent. Do not relocate it by filename.
- A replacement version with a different duration prompts the user to adopt the new duration or keep the existing timeline length.
- Users can create layers by dropping above an existing layer and can rename them. Their initial name is exactly `new layer`.

### Proposed model

`Workspace -> Project -> Scene -> Shot`

A shot is represented by a parent card on the parent video layer. Parents own child clips on upper layers, which may represent production stages. A clip can contain multiple immutable media versions with an explicitly active version. Each placement stores its timeline position, source in/out range, parent ID where applicable, and layer ID. A media version and its placement are different records: trimming a placement does not replace the source version.

The initial parent duration comes from its imported video. A different-duration replacement prompts for the desired placement length. The shot block spans the earliest start and latest end among the parent and all children. A longer child can extend this interval while the parent video keeps its media duration.

The timeline layer names in Figma include Storyboard and Animatics. Clicking the project title or an unlocked layer name places the caret directly in the name. Enter or leaving the field saves the edit. Escape cancels, and a blank entry restores the previous name. A layer’s three-dot menu opens beside its trigger. Choosing Delete layer opens a confirmation naming the layer before any clips or feedback are removed. The storyboard and locked layers are protected from deletion. Each clip version also has its own Stage dropdown in the Info panel.

### Proposed invariants

- Establish parentage from filename matching for an empty new layer, or from the chosen dashed cell for an existing layer, then persist stable parent/layer IDs. Renaming a layer or clip later must not silently break or rematch that ownership.
- Moving any member displaces the entire shot block by the same number of frames and preserves relative offsets and source intervals.
- Proposed: preserve the order of selected parents when closing gaps.
- Never silently detach children, discard inactive versions, or mutate originals.
- Use frame-based or integer media times with an explicit frame rate/timebase. Avoid accumulated rounded seconds as authoritative positions.
- Group operations are atomic. A locked or unauthorized affected child should block the whole operation rather than leaving children behind; the lock policy requires review.
- Shot blocks are disjoint. When footage needs more space, consume the available gap first and push each overlapping neighbor with all its children by the minimum required distance.

### Moving clips already on the timeline

**Confirmed.** Dragging a child horizontally moves its parent and every sibling. An edge insert moves the block to the indicated side. Centering on a clip in another shot swaps both blocks. The preview includes the affected clips and their feedback pins.

A dashed upper-layer cell identifies its parent during a file drop. Where a clip occupies the cell, its visible center and edges provide the version and insertion targets.

**Confirmed.** A move into free space leaves the original shot position empty. Dropping into occupied time makes room for the entire shot. Children keep their relationship to the parent throughout the move.

While dragging a placed clip over an insertion edge, preview its full length at the destination and shift neighboring clips to their proposed positions. Linked children and feedback pins follow their clips in the preview. Dropping commits the displayed positions as one move. Leaving the insertion target or canceling restores the original layout.

Hovering a placed clip over the center of another previews both clips in their exchanged positions, including any shifts needed for unequal lengths. Dragging files from File Explorer between clips opens a provisional slot and moves the neighboring clips aside. After drop, import uses the actual video durations to size the insertion. A file dropped on a clip’s center still adds a version.

### Magnet example

Select a child of shot A and the parent of shot B and press Snap All. If B moves 30 frames earlier to close the gap, every child of B moves 30 frames earlier. Selecting another member of B still moves that block only once.

## 8. Editing toolbar

The twelve actions below are confirmed. Proposed details remain subject to review.

| Action | Behavior |
| --- | --- |
| Delete | Confirmed: remove the selected timeline item; deleting a parent also removes only its linked children. Proposed: perform the whole group deletion as one undoable action while retaining source media/version history. |
| Undo | Reverse the most recent eligible edit. Proposed: a parent-group operation or Snap All is one step; undo must not overwrite another user's unrelated changes. |
| Redo | Reapply the last undone eligible edit. Proposed: a new edit clears that redo branch; conflicts require resynchronization. |
| Split | Split only the selected clip at the playhead. |
| Delete Left | Trim only the selected clip before the playhead and retain the later portion. |
| Delete Right | Trim only the selected clip after the playhead and retain the earlier portion. |
| Add Video to Right | Confirmed: add a parent to the right when the parent layer is selected, or add a child to the right on the selected upper layer. Preserve the command's selected destination; the automatic filename rule for an empty new layer does not relocate an explicitly placed clip. Placement conflicts and insufficient-space rules remain Open. |
| Add Video to Left | Confirmed: mirror the right-side command on the left, with parent/child creation determined by the selected layer. Preserve the selected destination. Placement conflicts remain Open. |
| Enable/Disable Snap | With snapping enabled, a dragged child can snap to a shot boundary. Moving the child carries its entire shot in either mode. |
| Snap All / Magnet | Each selected clip identifies its shot. Within each consecutive run of selected shots, keep the first in place and close gaps in timeline order. An unselected shot separates runs. |
| Rearrange | Restore the selected shot blocks to natural numeric order by parent filename. Selecting any member identifies its entire block. Keep the relative order of unselected shots. |
| Slip Tool | When the source exceeds the cell length by at least one frame, drag the footage inside the selected cell. Drag left to reveal later footage and right to reveal earlier footage. Faded dashed outlines outside the cell show how much source footage is excluded on each side. Preview while dragging and record one undo step on release. The source interval stays within the media bounds and the cell keeps its timeline start, end and duration. |

### Shared editing rules

- Disable ineligible actions with an explanation: missing selection, permission, valid media, or eligible playhead position.
- Edits change timeline decisions; they do not re-encode or overwrite originals.
- Use one boundary convention for Split and directional trims. Proposed: the playhead is a boundary; the right-hand split includes the frame beginning there.
- Never create zero-length clips, negative timeline times, or source ranges outside the referenced version.
- An ordinary Delete leaves a gap under the proposed default. Snap All is the explicit gap-removal action unless a separate ripple rule is approved.
- Feedback keeps its immutable version/source-time reference after edits. Context outside a new visible range remains identifiable rather than being dropped or reassigned.
- Select multiple clips by dragging with the left mouse button from any empty part of the dotted timeline, including the space above, below and between tracks. The rectangle can extend across layers. Ctrl + click toggles individual clips and Shift + click extends a range from the selection anchor. Shift-click includes both endpoints and works in either direction. Across layers, it includes clips in the time range on the rows between the endpoints. Ctrl+Shift-click adds that range to the current selection.
- Dragging any selected member moves all selected shots together. Count each parent block once. Preserve shot order, spacing, and parent-child offsets. At an edge, insert the whole selection on that side. At a center, swap the group with the target shot. Preview all affected positions. Escape cancels the drag and Undo reverses a committed move in one step.
- When the timeline extends beyond the visible width, wheel down pans right and wheel up pans left. Panning preserves the playhead time and selection. During playback, a manual pan takes priority until playback restarts. When the entire timeline fits horizontally, the wheel can scroll vertically through the layers.
- Split, Delete Left, and Delete Right require exactly one selected clip. With multiple clips selected, disable all three commands, including shortcut invocation, even when only one selected clip crosses the playhead.

## 9. Playback, media, stages, and versions

### Confirmed playback rules

- Evaluate visible layers from top to bottom at every playhead position. Display the first layer containing a video clip covering that position.
- Skip hidden layers and visible layers with no video at that position.
- A clip can occupy more timeline time than its video covers. Once its video ends, play the highest visible layer below it that has video at the playhead.
- A shorter upper clip does not hide longer clips below after it ends. Reveal the next visible layer containing video for the remaining time; do not freeze or stretch the upper clip to fill that time.
- Example: a lower clip covers `[0, 10)` seconds and an upper clip covers `[0, 6)`. Play the upper clip for the first six seconds, then the lower clip from seconds six to ten using its corresponding source positions.
- Layer visibility determines normal timeline playback; selecting a lower clip or a stage in another control does not override the visible layer stack.

### Proposed playback requirements

- Provide Play/Pause, scrubbing, previous/next navigation, preview zoom, fullscreen, and timeline zoom. Whether previous/next means frames, clips, or shots is Open.
- Keep selected clip, active playback version, and playhead distinct. Opening history must not silently activate an older version.
- Show the active scene/shot/stage/version, uploader, and a correctly formatted time display. Project frame-rate/time-display rules remain Open; placeholder ruler labels are not production specifications.
- Within each clip's version stack, only its active version participates in normal timeline playback. Historical versions are not additional timeline layers. Selecting feedback on an older version may open an explicitly labeled version-review view.
- When no visible layer has video at the playhead, show a neutral empty preview rather than holding the previous frame. Processing/buffering failures should remain distinguishable from an intentional timeline gap.
- The confirmed rules define which video layer supplies the picture. Audio mixing, transparency, and effects remain separate scope decisions.
- Expose loading, buffering, unavailable media, unsupported media, and processing failure separately with useful recovery actions.
- Preserve previous media versions. Deliberate activation changes are recorded with actor/time.

### Media and platform constraints

- Carry forward NAS-only video storage and delivery, shared login, and authorized asset/media services from the platform requirements.
- Proposed intake states: selecting/uploading, interrupted, validating, processing, ready, failed. Preserve retry/resume context and the intended project/parent/stage.
- Proxies/thumbnails can support review; editing references originals and explicit source-time mappings.
- **Preload Video (confirmed).** Load the active version of each clip on the current layer first. Once that media is ready for playback, preload the remaining project media in the background, including other layers and alternate versions. The reviewer can play the current layer while background loading continues.

### Upload names and scene/shot detection

If several scene and shot pairs are plausible, ask the uploader to confirm the intended pair or enter the correct numbers. If no pair can be detected, ask the uploader to enter both numbers. Use the resolved values for the in-app name and any automatic parent match.

Read complete pairs in filename order. A repeated pair such as `01_04_01_04` resolves to `01_04`. Named episode, take and version numbers are metadata. An unambiguous filename imports immediately.

On upload, inspect the full filename stem for the scene and shot even when other text appears before or after them. Use the detected numbers to set Scene and Shot and give the clip its in-app name in `SCENE_SHOT` format. Both `01_02.mov` and `avvasjnak_01_02.mov` yield the display name `01_02`, Scene 1, Shot 2. The rename applies within SceneFlow. Use the extracted scene and shot for initial ordering, automatic parent matching on a new layer, and Rearrange. Explicit drops into dashed cells still use the chosen destination.

### Drag-and-drop intake and filename ordering

Confirmed:

- A new project starts with an empty timeline. Clips are uploaded by dragging files into it.
- Automatically arrange imported clips by name, for example `01_01` followed by `01_02`, regardless of the order in which the files were selected or dragged.
- When children are dropped into an empty new layer, match their names to parent-card names and align them automatically.
- When a child is dropped onto a dashed cell in an existing layer, place it in that cell. The user's destination takes precedence over filename matching, including when the filename matches a different parent.
- Example: dropping `01_02` into the dashed cell corresponding to parent `01_01` on an existing upper layer leaves it in the chosen `01_01` cell. Do not move it to `01_02` automatically.

Proposed details:

- Support both individual files and batches. Show the intended destination and import order before committing a drop.
- Use natural numeric ordering so Scene 1, Shot 2 sorts before Scene 1, Shot 10.
- For an empty new layer, match names during intake and save stable relationships afterwards. For an existing-layer cell drop, save that cell's ownership and placement instead. Do not repeatedly reassign children when display names change.
- For the first parent-layer batch, place clips consecutively in filename order using their imported durations. The exact insertion policy for later batches must preserve deliberate existing edits unless the user chooses to rearrange them; this is Proposed.
- Preserve automatic ordering/matching for an empty new layer and explicit cell destinations for an existing layer while uploads finish out of order. A slow upload must not accidentally change the intended layout.
- Show import progress and allow failed files to be retried without duplicating successful placements or versions.
- If filename matching is ambiguous or has no match, ask the user to choose an existing parent. On an empty timeline the first imported batch establishes the storyboard. A deliberate existing-layer cell drop uses that parent directly.

### Contextual drop targets

The drag source and pointer position determine the result. The same visible clip can receive an insert, version, or swap gesture.

| Drop destination | Result | Preview |
| --- | --- | --- |
| New file between clips or near a clip’s left or right edge | Insert on the indicated side and make space on the destination layer. | Show the insertion point before release. |
| New file at the center of an existing clip | Add a version to that clip. | Show `v2` when the target currently has V1. |
| Placed timeline clip at the center of a clip in another shot | Swap their shot blocks. | Preview both blocks, including siblings, before release. |
| A dashed empty cell within an existing layer | Add a clip in the cell chosen by the user. On an upper layer, the cell supplies the parent association. | Highlight the single dashed cell under the pointer before release. |
| Blank space above a layer, outside existing clip/row drop targets | Create a layer at that location, named exactly `new layer`, and place the dropped clips in it. For this empty new upper layer, match and align children to parents by filename. The layer can be renamed. | Highlight the entire prospective row before release to show where the new layer will appear. |

Proposed interaction safeguards:

- Keep row, clip, and new-layer insertion targets visually distinct. Update the preview as the pointer crosses between them; canceling the drag changes nothing.
- Where a moved clip covers a dashed cell, use the visible clip for hit testing. The preview should identify the chosen action before release.
- Keep the current version active during upload and validation. Once the new version is ready and any duration choice is resolved, apply the confirmed activation rule in the Info panel.
- A failed new-layer drop must not leave an unexplained empty layer; a failed version upload must preserve the previous usable version.
- Batch drops onto a single existing clip still require an explicit policy before implementation.

### Different-duration version prompt

Confirmed:

- Compare the replacement version's duration with the existing timeline clip length. If they differ, ask before applying a length change.
- Offer **Adopt New Duration** and **Keep Existing Length**. Apply the choice to the target clip instead of silently resizing or preserving it.
- The prompt applies to version replacement on any layer, including a parent clip.
- With **Keep Existing Length**, preserve the clip's start and end on the timeline. If the replacement video ends earlier, show the next visible layer with video at each remaining playhead position.

Proposed interaction details:

- Show both durations using the project time display so the effect of the choice is clear.
- Wait until media metadata is available before asking. Do not move neighboring clips or resize the target merely because an upload starts.
- Provide Cancel; canceling leaves the active version and timeline placement unchanged.
- When Adopt New Duration expands a placement, or unequal shot blocks swap, use existing gaps first and move every affected neighboring block by the minimum required distance.

## 10. Feedback, information, and activity

### Feedback

Group feedback under always-expanded shot headings such as `Shot 01_02`. Use the reviewed clip's scene and shot identifier across layers and versions. Order groups by scene and shot number, with the newest feedback first inside each group. Show a heading only when at least one card in that group matches the current filters.

The reference frame shows All Shots/Active Shot filters, All/Pending/Done/Approved filters, and cards with author, time, replies, and status controls. The revised Feedbacks panel offers Text (T) and Voice (V). Drawing starts directly on the media playback screen.

**Text drafts.** Pressing **T** places a gray marker at the current playhead position and focuses the new text box immediately. Playback continues while the reviewer types. **Enter** submits the feedback and **Shift+Enter** inserts a line break. Enter used to confirm an in-progress character composition keeps the draft open. **Attach Image** and **Submit** remain available in the composer. Reviewers can return to earlier drafts and submit them at the original timestamps. Submitted pins use the author’s color.

**Voice capture.** With microphone access available, pressing **V** while idle places a gray marker, starts recording immediately, and opens the feedback composer with **Attach Image** and **Submit**. Pressing **V** while recording ends capture and submits that recording as one Pending item at its original marker time. The **Submit** button performs the same action. The next press of **V** starts a fresh recording at the current playhead position. Video continues playing throughout if already playing.

**Drawing on the player.** The first stroke directly on the player pauses playback and immediately creates a feedback item and marker on that frame. Additional strokes accumulate on that drawing as the video stays paused until the reviewer presses Play. When the reviewer returns to that drawing’s marker later, further strokes append to the same feedback item and are reflected in its thumbnail and full image. Saving the drawing requires no Submit action.

**Images in the list.** Drawn feedback shows a thumbnail of the annotated frame. Feedback with an attached image shows a thumbnail of that attachment. Selecting either thumbnail opens the corresponding full image.

### Feedback card controls

| Current state | Card indicator | Action and result |
| --- | --- | --- |
| New Pending | Empty checkbox | Click the checkbox to move to Done and show a tick. |
| Done | Tick | Click the tick or choose **Revert** from the three-dot menu to return to Pending with a red circle. Click **Approve** to move to Approved and show a star. |
| Returned to Pending | Red circle | Click the status control to move to Done again and show a tick. This item appears in the Pending filter. |
| Approved | Star | Choose **Revert** from the three-dot menu to return directly to Pending with a red circle. |

Each feedback card has a three-dot menu in its corner with **Edit feedback** and **Delete feedback**. Done and Approved cards also include **Revert** in that menu. The status indicator belongs to the card. The submitted timeline pin continues to use the author’s color.

Each card starts with one permanent label matching its pin. The label is gray on a draft and takes the author’s color on submission. Additional labels can be added or removed independently. Clicking the card surface seeks to the pin’s frame and clip version. The card’s editing, status, attachment and comment controls retain their own actions. Starting a drawing while playing pauses on the first stroke. Further strokes on the same paused frame extend that drawing and share its pin and thumbnail.

The permanent color label uses a user icon. Press `[` for the previous feedback pin or `]` for the next pin in timeline order. Navigation follows the current feedback filters and visits each feedback individually when several share a frame. In a text field, both keys insert their normal characters.

### Timeline feedback pins

Confirmed:

- Show a pin at the timeline position where feedback was given. The design places these markers above the corresponding upper-layer clips.
- Use gray for unsubmitted text and voice markers. Use the feedback author's color for submitted pins.

Proposed interaction and data rules:

- Link a pin to a feedback record and its immutable media version/source-time anchor. Store author identity using the account ID, not a display name or list position.
- Use the same author-color mapping consistently across the project. Reuse a shared KHP member color if one is established; otherwise assign a stable accessible palette color. Exact palette ownership is an implementation choice pending shared profile integration.
- Clicking a pin seeks to its feedback time and opens/highlights the matching feedback card. Hover/focus shows the author, timestamp, and a short feedback preview.
- Provide author names and accessible labels as well as color so similar colors do not prevent identification.
- Recalculate pin positions when a parent/child moves. After a split, map the existing feedback to the segment containing its source-time anchor; do not duplicate the feedback message.
- If trimming removes the referenced frames from the current edit, keep the feedback in its version/history context and omit its pin from the surviving visible range.
- Keep closely spaced or coincident pins individually reachable through stacking or a grouped picker. Align their visibility with the active feedback filters.

### Other proposed feedback requirements

- Support text, frame annotations, and voice feedback. Voice recording needs explicit recording/cancel/upload/error states and appropriate microphone permission handling.
- Store project, parent/shot, stage, immutable version, and source-time context.
- Selecting feedback seeks to that context and identifies an older version when applicable.
- Support replies and authorized status changes with actor/time history.
- Combine shot/status filters and provide clear empty/reset states.
- Store normalized image coordinates so drawing placement survives preview resizing.
- Feedback permissions, including who can edit, delete, mark Done, approve, and revert, will be defined during backend development.
- Suppress T and V shortcuts while the reviewer is typing in a text field so entering feedback does not create extra markers.

### Info panel

**Clip details.** Show Scene, Shot, **Clip Duration**, **Timeline Start**, and **Timeline End** for the selected placement. Duration is the length occupied by the clip on the timeline. Start and end are its positions on the project timeline. Moving the clip updates both positions, and trimming updates the affected boundary and duration. Scene and Shot come from the upload name even if the clip is placed in another parent column. Show **Added By** with the username and date and time of addition, and **Last Edited By** with the most recent editor’s username and edit date and time.

**Shot Information.** Each shot starts with five empty text boxes in this order: **Camera**, **Description**, **Dialogue**, **Action**, and **Location**. Every layer and version of the same shot shares these values. An edit made while viewing one version appears when viewing any other layer or version of that shot.

**Versions.** List versions of the selected clip. Let the user select a version or upload a new version to that same clip. Apply the existing duration prompt when a new version differs in length. Each version has its own **Stage** dropdown with these choices in order: **Not Set**, **Block**, **Animatics**, **Polished**, **Complete**. Changing V2’s Stage preserves V1’s Stage and the timeline layer name.

**Confirmed playback behavior.** Once the new version is ready and any duration choice is resolved, select it in Info and make it active for that clip. Timeline playback shows this version wherever the clip is visible under the layer playback rules. Selecting V1 again makes V1 active for playback.

### Edit panel

For the current release, the Edit panel offers the twelve commands defined in section 8. Both the panel and toolbar act on the current timeline selection and playhead, with the same availability rules, snap setting, and undo history. For example, selecting multiple clips disables Split, Delete Left, and Delete Right in both places.

### Activity and KHP tasks

- Show significant committed uploads, edits, activation, feedback, and approval changes with actor, resource, and time.
- Confirmed scope: Visibility, Action, Updated, and Updated by filter only the activity log in the left panel. The Updates list, count, and result range reflect the matching events. The timeline, player, and right-hand panels keep their own state.
- The left panel fits the available screen height. Scrolling the updates list keeps the filter header, update count and pagination in place. When vertical space is limited, the expanded filter fields can scroll within their section.
- Carry forward SceneFlow-to-KHP task creation with a source link back to the relevant project/shot/feedback. The entry point and required fields remain Open.
- Retried task creation must not create duplicates. KHP owns the resulting task.

## 11. Persistence, collaboration, and failures

Proposed release requirements consistent with the shared platform proposal:

- Persist metadata, hierarchy, edits, versions, and feedback on the shared server. Browser-only state is insufficient for the shared release.
- Distinguish Unsaved, Saving, Saved, Failed, and Conflict. Saved means durable server acceptance.
- Give operations unique IDs and revision expectations; retries must not apply an edit twice.
- Commit parent and affected children together, including Snap All.
- Conflicting edits resynchronize with an explanation instead of silently overwriting or partially applying structural changes.
- Recover missed updates after reconnect and preserve acknowledged edits through refresh/service restart.
- Resolve pending edits/drafts before exit. Draft recovery does not imply offline collaborative editing.
- Enforce shared permissions for media, feedback, tasks, and live updates.

The shared release targets five simultaneous SceneFlow users. In the frontend milestone, a local reviewer switcher exercises the uploader and reviewer workflows within one browser profile.

## 12. Acceptance criteria

Proposed criteria depend on product review; Confirmed criteria reflect the user's instructions.

| ID | Acceptance condition | Status |
| --- | --- | --- |
| SF-01 | The timeline toolbar includes the twelve specified actions, including Rearrange and Slip Tool. | Confirmed |
| SF-02 | Delete Left trims only the earlier portion of the selected clip at the playhead. | Confirmed |
| SF-03 | Delete Right trims only the later portion of the selected clip at the playhead. | Confirmed |
| SF-04 | Select children from consecutive shots and press Snap All. Their parent blocks close the gap. Selecting an additional sibling moves its group only once. | Confirmed |
| SF-05 | Proposed: preserve selected clip order and restore the affected placements in one Undo step. | Proposed |
| SF-06 | A blocked child prevents an entire grouped edit; no partial parent/sibling movement occurs. | Proposed |
| SF-07 | With clips on several layers crossing the playhead, splitting a parent or child creates two segments only on the selected placement. | Confirmed |
| SF-08 | Add Left/Right creates a parent on the parent layer or a child on the selected upper layer at the selected relative destination. | Confirmed |
| SF-09 | Snap toggle changes subsequent interaction behavior without immediately moving existing media. | Proposed |
| SF-10 | Drag a child, then delete its parent. The child and its siblings move with the parent and are removed with it. | Confirmed |
| SF-11 | The player shows the topmost visible layer with video at the playhead and falls through to lower visible video wherever upper clips do not cover that time. | Confirmed |
| SF-12 | Feedback retains exact version/source-time context through trims, splits, activation, and movement. | Proposed |
| SF-13 | Shot/status filters combine correctly and the server rejects unauthorized approval changes. | Proposed |
| SF-14 | Refresh/reconnect restores acknowledged edits and feedback; retries create no duplicate edits/tasks. | Proposed |
| SF-15 | Concurrent structural edits either commit atomically or show an explicit conflict; no child drifts. | Proposed |
| SF-16 | Shared KHP login and workspace permissions govern SceneFlow media and task access. | Existing platform requirement |
| SF-17 | Failed/interrupted uploads preserve their intended parent/stage context and expose a recovery action. | Proposed |
| SF-18 | Source media storage and playback delivery remain on the NAS. | Existing platform requirement |
| SF-19 | Missing media, processing failure, save failure, and conflicts are distinguishable from an empty project. | Proposed |
| SF-20 | Core controls have accessible names, keyboard focus, and status cues beyond color alone. | Proposed |
| SF-21 | Text and voice draft pins are gray. On submission, the pin uses the author's color at the original feedback time. | Confirmed |
| SF-22 | Clicking a pin seeks to its exact context and opens the matching feedback; author identity is available without relying on color alone. | Proposed |
| SF-23 | Parent movement carries linked children and their feedback pins. A split does not duplicate feedback; a trimmed-out anchor remains available in version/history context. | Proposed |
| SF-24 | Splits and trims preserve valid source ranges and avoid zero-length segments. | Proposed |
| SF-25 | A newly created project has an empty timeline and accepts clips through drag-and-drop upload. | Confirmed |
| SF-26 | An initial automatic import of `01_02` and `01_01` orders them as `01_01`, then `01_02`. This does not override explicit existing-layer cell drops. | Confirmed |
| SF-27 | Children dropped into an empty new layer link and align to matching parent cards by filename. | Confirmed |
| SF-28 | A version drop on a V1 clip shows `v2` before release and creates a new version on drop. | Confirmed |
| SF-29 | Dropping onto a dashed cell in an existing layer places the clip in that chosen cell, without creating a version or another layer and without relocating it by filename. | Confirmed |
| SF-30 | Dropping into blank space above a layer creates a layer at that position named `new layer`; the user can rename it. | Confirmed |
| SF-31 | Drop previews distinguish new clips, versions, and new layers; canceling a drag causes no timeline mutation. | Proposed |
| SF-32 | An upper clip covering seconds zero to six reveals a lower visible clip covering zero to ten for seconds six to ten. A hidden upper layer never covers lower video. | Confirmed |
| SF-33 | Different upload completion orders preserve filename-based placement for empty new layers and user-chosen cells for existing layers. A failed version upload leaves the previous version usable. | Proposed |
| SF-34 | Undoing a parent deletion restores the whole group; source media and version history survive placement deletion. | Proposed |
| SF-35 | Dropping `01_02` onto an existing upper layer's dashed cell for parent `01_01` keeps the chosen destination and parent association. | Confirmed |
| SF-36 | A different-duration replacement prompts for Adopt New Duration or Keep Existing Length before applying the choice; neither outcome is selected silently. | Confirmed |
| SF-37 | The duration prompt shows both lengths; Cancel leaves the active version and timeline placement unchanged. | Proposed |
| SF-38 | Replace the video in a ten-second clip with a six-second video and choose Keep Existing Length. The clip still spans ten seconds. The player shows the replacement for the first six seconds and the highest visible lower layer with video for the final four seconds, at the corresponding timeline positions. | Confirmed |
| SF-39 | During a drag, moving from a dashed cell into blank space above the layer switches the highlight from that single cell to the entire prospective row before release. | Confirmed |
| SF-40 | Drag a child and verify that its parent and siblings move by the same amount in the preview and after release. | Confirmed |
| SF-41 | Dropping at an edge inserts the dragged shot block. Dropping at the center of a clip in another shot swaps both blocks. | Confirmed |
| SF-42 | Where a moved clip occupies a parent cell, the visible clip receives the hover. An incoming file near its edge inserts, an incoming file at its center creates a version, and a placed clip at its center swaps. | Confirmed |
| SF-43 | Snapping a child to a shot boundary also moves its parent and siblings. | Confirmed |
| SF-44 | Upload child 01_02 into parent 01_01 and drag the shot out of order. Select the child and press Rearrange. The entire 01_01 block returns to its filename order and the child remains attached to 01_01. | Confirmed |
| SF-45 | An editor can select multiple clips using a left-button drag rectangle, Ctrl + left-click, or Shift + left-click. | Confirmed |
| SF-46 | For a 12-second source uploaded into an 8-second cell using Keep Existing Length, Slip Tool can change the visible source interval from seconds 0–8 to 3–11. Playback uses that interval and both timeline boundaries stay fixed. The latest valid source start is second 4. | Confirmed |
| SF-47 | Select members on different layers and apply Snap All. Consecutive selected shots close gaps, respecting unselected shot boundaries. | Confirmed |
| SF-48 | Swap clips of unequal length or adopt a longer version. Later clips shift right by the minimum distance needed to resolve overlap. Shifted parents carry their linked children. | Confirmed |
| SF-49 | With two or more clips selected, invoking Split, Delete Left, or Delete Right performs no edit. | Confirmed |
| SF-50 | Rearrange selected blocks of different lengths. Parents and children keep their relative offsets, and neighboring blocks move together to make space. | Confirmed |
| SF-51 | With playback running, press T and later V. Each press immediately creates its own gray marker and opens a text box with Attach Image and Submit. Playback continues. Return to the first marker and submit it at its original timestamp while the second remains a draft. | Confirmed |
| SF-52 | Draw a circle and an arrow on a playing frame. The first stroke pauses playback and immediately creates one feedback item. Press Play, return to its marker, and add another stroke. The same item shows all three strokes without a Submit step. | Confirmed |
| SF-53 | A drawing card opens the full annotated frame from its thumbnail. A card with an attached image opens the full attachment from its thumbnail. | Confirmed |
| SF-54 | With microphone permission granted and video playing, press V at second 10, speak, and press Submit at second 15. Recording begins on V and ends on Submit. The list contains one Pending voice item anchored at second 10. Playback continues throughout. | Confirmed |
| SF-55 | A new Pending card has an empty checkbox. Clicking it shows a tick and moves it to Done. Clicking the tick returns it to Pending with a red circle. | Confirmed |
| SF-56 | Approve on a Done card moves it to Approved and displays a star. From either Done or Approved, choosing Revert in the three-dot menu moves the item directly to Pending, displays a red circle, and includes it in the Pending filter. | Confirmed |
| SF-57 | The feedback card’s corner menu offers Edit feedback and Delete feedback. Selecting Delete feedback immediately removes the card and its pin. Discard draft also takes effect immediately. | Confirmed |
| SF-58 | Press V at seconds 10, 15, and 20 during playback. The first press begins recording at 10, the second submits one voice item anchored at 10, and the third starts a new recording anchored at 20. | Confirmed |
| SF-59 | Select an eight-second clip named `01_02` placed at twelve seconds. Info shows Scene 1, Shot 2, Clip Duration 8 seconds, Timeline Start 12 seconds, Timeline End 20 seconds, Added By, and Last Edited By. Moving it to second 15 updates the start and end to 15 and 23 seconds while duration stays at 8 seconds. | Confirmed |
| SF-60 | Create shot 01_02 and verify its five shot information fields start empty. Enter Dialogue on one layer, then select a different layer and version of 01_02. Both show the same Dialogue. This sharing applies to Camera, Description, Action, and Location as well. | Confirmed |
| SF-61 | From Info, select an existing version and upload a new version of the same clip. Set V1 to Block and V2 to Polished. Selecting each version shows its own Stage from the specified five options. | Confirmed |
| SF-64 | With V1 active and its clip visible at the playhead, upload V2 and resolve any duration prompt. Once V2 is ready, Info selects V2 and playback shows V2. Select V1 again and verify playback shows V1. | Confirmed |
| SF-62 | In separate imports, both `01_02.mov` and `avvasjnak_01_02.mov` appear as `01_02` in SceneFlow. Info shows Scene 1 and Shot 2 for each. A child imported into an empty new layer aligns to parent `01_02` using the extracted values. | Confirmed |
| SF-63 | Upload a file with two plausible scene and shot pairs, then one with no pair. The uploader can confirm or enter the intended numbers in the first case and enter both numbers in the second. The in-app name and Info fields reflect the resolved values. | Confirmed |
| SF-65 | With multiple layers and clip versions in a project, click Preload Video. The active versions on the current layer load first. They can play while the remaining media loads in the background. | Confirmed |
| SF-66 | Delete a layer, then delete multiple clips. Checkpoints offers both pre-change states. Selecting the earlier checkpoint restores the timeline as it stood immediately before the layer deletion. | Confirmed |
| SF-67 | With a visible six-second upper clip over a ten-second lower clip, Export Full Video produces the current upper version for the first six seconds and the lower clip for the final four. | Confirmed |
| SF-68 | Select three clips from a timeline containing four clips. Export Selected Clips produces exactly three video files, one for each selected clip. | Confirmed |
| SF-69 | Person A uploads clip 01_02. Person B posts two feedback items at different times on it. Person A sees who posted feedback and on which clip. Clicking the notification for the first item opens 01_02 and displays that first item at its recorded version and time. | Confirmed |
| SF-70 | Place a 12-second child over an eight-second parent and keep its source duration. The next shot and all its children start at or after second 12. The parent video still ends at second eight. | Confirmed |
| SF-71 | Two child clips whose active versions share an uploader have matching stripes. Switching to a version by another uploader displays that person's color. Parent cards use a neutral border. | Confirmed |

### Proposed performance validation

Agree on project sizes, footage, browsers, and representative networks before the pilot. The platform proposal suggests five simultaneous users, proxy playback startup p95 under three seconds, warm seeks p95 under one second, and no lost acknowledged edits. These are untested objectives dependent on the media pipeline and actual NAS/network conditions. Timeline interaction targets and project-size limits remain to be defined.

## 13. Proposed delivery slices

| Slice | Outcome | Completion evidence |
| --- | --- | --- |
| 0. Foundation | Next.js app in the requested directory and reviewable PRD. | Build/lint/typecheck results and product review. |
| 1. Workspace and hierarchy | Figma-based shell with an empty default timeline, layer creation/renaming, drop previews, filename ordering/matching, and visible-layer playback. An optional sample project must be explicitly selected. | Visual review plus verified drop classification, matching, hierarchy, and playback fallback. |
| 2. Editing | All twelve tools and multi-selection, version drops, and approved trim, split, insertion, magnet, lock, and undo rules. | Acceptance checks including grouped edits, parent deletion, and child-offset preservation. |
| 3. Shared foundation | Authorized NAS media, versions, durable saves, and conflict recovery. | Refresh/reconnect, permissions, media, and concurrency checks. |
| 4. Review and integration | Feedback, activity filters, approval, KHP task links. | End-to-end review with multiple authorized users. |
| 5. Pilot | Production-sized projects, five-user evaluation, recovery, deployment readiness. | Recorded pilot results and resolved operational dependencies. |

These are outcome slices, not authorization to implement all product features now. The shared backend/media foundation remains a dependency.

## 14. Open decisions before implementation

| Priority | Decision | Why it matters |
| --- | --- | --- |
| 1 | When a longer child extends beyond its parent’s range, should the parent also grow? | Defines parent duration. |
| 2 | What should happen if the resolved scene and shot match several parent cards? What should multiple files dropped onto one clip do? | Completes duplicate-parent matching and batch version intake. |
| 3 | How should later automatic batches on the parent layer interact with earlier edits? | Defines ordering outside explicit insertions. |
| 4 | How should Snap All report a locked clip that would need to move? | Defines locked-selection handling. |
| 6 | What are the frame rate/time display, previous/next navigation, snap targets, and shortcuts? | Defines precise interactions. |
| 7 | Where in SceneFlow should users create KHP tasks? | Defines the entry point for task creation. Feedback role assignments are deferred to backend development. |
| 8 | What audio mixing is needed? | Defines audio behavior. |

## 15. Calls left to the builder

After product approval, the implementer may choose ordinary component boundaries, state organization, design tokens, rendering optimizations, and test tooling within the approved behavior/platform constraints. New domain behavior, changed hierarchy guarantees, cloud media delivery, or a different backend/authentication strategy require a product or architecture decision.

The [frontend implementation plan](../plans/2026-11-21-sceneflow-frontend.md) covers the approved browser-local milestone. The team can use the working editor to review the remaining product choices before shared platform integration.
