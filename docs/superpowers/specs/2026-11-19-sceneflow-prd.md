# SceneFlow Product Requirements Document

Date: 19 November 2026  
Version: 0.4  
Status: Draft for product review. The Next.js scaffold is authorized; this document is not yet an approved feature implementation plan.  
Application: `apps/sceneflow-web`

## 1. Purpose

SceneFlow gives the production team one workspace to arrange shots, review stage videos and versions, make timeline edits, and record feedback against the correct media context.

A new project starts with an empty timeline. Users upload clips by dragging and dropping them. Filenames such as `01_01` and `01_02` determine initial automatic shot ordering. Children dropped into an empty new layer match and align to their parents by filename; children dropped onto a dashed cell in an existing layer use the cell the user chose. The drop location determines whether a clip is placed in an existing layer, becomes a new version of an existing clip, or creates a new layer.

The timeline has a parent layer containing the large cards. Corresponding clips on the layers above are children. The parent and its children form a production unit. The magnet action compacts the parent layer and carries its corresponding children with it.

This draft combines the supplied Figma design, the user's toolbar and hierarchy clarifications, and the existing shared platform requirements. Proposed behavior and unresolved decisions are identified explicitly.

## 2. Sources and requirement status

| Source | Evidence and limits |
| --- | --- |
| [Figma: KHP / Scene Flow, node 28:3](https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=28-3) | Reviewed in the browser on 19 November 2026. The main frame is 1726 by 1354. The Scene Flow page also contains stage/version examples. Static drawings establish visible controls, not complete interaction rules. |
| User: editing toolbar | Delete, Undo, Redo, Split, Delete Left, Delete Right, Add Video to Right, Add Video to Left, enable/disable snap, and Snap All as a magnet action are required. |
| User: directional deletion | Delete Left and Delete Right trim the selected video at the playhead. They do not delete all timeline clips on that side. |
| User: timeline hierarchy | The layer with large cards is the parent. Corresponding clips above are children. Snap All acts on the parent layer and carries its children with it. |
| User: parent editing | Splitting or trimming a parent also splits or trims all its children at the same timeline playhead position. |
| User: feedback pins | Pins indicate where feedback was given. Pin color identifies the user who gave that feedback. Pins above upper-layer clips were verified in the browser on 19 November 2026. |
| User: insertion and deletion | Add Video Left/Right creates a parent when the parent layer is selected and a child when an upper layer is selected. Deleting a parent also removes all its children. |
| User: playback | At each playhead position, display the topmost visible layer containing video there. When its clip ends, reveal the next visible layer containing video for the remaining time. |
| User: drag-and-drop intake | Start with an empty timeline; accept dragged clips and automatically arrange them by name, such as `01_01`, `01_02`. |
| User: drop targets and layers | Dropping onto an existing clip creates a new version and previews `v2` before dropping. Dropping onto a dashed cell in an existing layer obeys the chosen cell. Dropping into blank space above a layer creates a new layer named `new layer`, which can be renamed. This applies to any layer. |
| User: conditional upper-layer matching | Children match and align to parent cards by filename when dropped into an empty new layer. A drop onto a dashed cell in an existing layer takes precedence over filename matching. This clarification supersedes the earlier general matching rule. |
| User: replacement duration | When a new version has a different duration, ask whether to adopt the new duration or keep the existing timeline length. Do not silently select either outcome. |
| [Shared platform architecture, 17 November 2026](2026-11-17-shared-dotnet-platform-architecture.md) | Records shared KHP login, task integration, NAS-only video storage/delivery, and an initial five simultaneous SceneFlow users. Detailed backend/media designs are architecture proposals, not evidence of implemented services. |
| Current repository | KHP and Moodboard have separate Next.js frontends. SceneFlow is newly scaffolded. This review does not establish production backend, migration, or media-service readiness. |

**Confirmed** means explicitly requested by the user. **Observed** means visible in Figma. **Proposed** means a recommended rule awaiting review. **Open** means the affected behavior must be decided before implementation.

## 3. Goals and boundaries

### Goals

- Preserve parent/child relationships during timeline changes.
- Make drag-and-drop intake predictable, with filename ordering and clear previews of placement, version creation, and new-layer creation.
- Provide all ten requested editing actions with predictable results.
- Let reviewers navigate media and identify its scene, shot, stage, and version.
- Keep feedback attached to the correct version and source time.
- Preserve originals and previous versions.
- Share authorized project changes without silently losing acknowledged edits.
- Fit the shared KHP platform and NAS media constraints.

### Proposed first-release boundaries

Cover the designed review workspace, parent/child timeline, requested tools, layer creation/renaming, stage/version selection, drag-and-drop media intake, feedback, and shared persistence/integration. New projects are empty by default. An interface milestone may offer an explicitly selected sample project, but must be described as a prototype until real shared access and server persistence exist.

Advanced effects, transitions, color grading, independent audio mixing, arbitrary nested timelines, offline collaborative merging, and finished-film rendering are not established by the design or toolbar request. Their scope remains open; they are not assumed prerequisites for the first interface milestone.

Unacceptable outcomes include children drifting during parent movement, edits overwriting original files, feedback silently attaching to a replacement version, and a Saved indicator appearing before durable acceptance.

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
| Overview | Stage selector showing Blocking, colored segments, palette, horizontal scroll. | Keep navigation synchronized with the main timeline. Color meaning and palette permissions remain Open. |
| Timeline | Ruler, playhead, large cards, upper clips, version badges, feedback pins above upper clips, track lock/visibility controls. | Start empty. Support contextual drop zones, filename ordering/matching, and user-created layers. Show ownership clearly. Pin color identifies the feedback author. |
| Right panel | Feedbacks, Info, Edit. | Maintain the same project/parent/stage/version context across tabs. Full Info/Edit forms are not defined by the main screen. |

The supplied desktop composition is the visual reference. Resizable/collapsible panels, usability at 1366 by 768, and tablet/mobile behavior are proposed items to validate during interface review, not additional supplied Figma screens.

## 7. Timeline hierarchy and invariants

### Confirmed rules

- Large cards form the parent layer. Corresponding clips above are children.
- Snap All compacts the parent layer and carries each parent's corresponding children with it.
- Delete Left/Right trim the selected video at the playhead.
- Splitting a parent splits all its children at that same timeline playhead position. Trimming a parent applies the same directional trim to all its children at that position.
- Parent editing uses one shared timeline cut position. Each child's corresponding source position is calculated from its own placement and source range; children need not share a source timestamp.
- Deleting a parent removes all of its child placements.
- Add Video Left/Right creates a parent on the parent layer or a child on an upper layer according to the selected layer.
- Children imported into an empty new layer match and align to their parent cards by filename.
- A dashed-cell drop in an existing layer obeys the chosen cell, even if the filename matches another parent. Do not relocate it by filename.
- A replacement version with a different duration prompts the user to adopt the new duration or keep the existing timeline length.
- Users can create layers by dropping above an existing layer and can rename them. Their initial name is exactly `new layer`.

### Proposed model

`Workspace -> Project -> Scene -> Shot`

A shot is represented by a parent card on the parent video layer. Parents own child clips on upper layers, which may represent production stages. A clip can contain multiple immutable media versions with an explicitly active version. Each placement stores its timeline position, source in/out range, parent ID where applicable, and layer ID. A media version and its placement are different records: trimming a placement does not replace the source version.

Proposed: the initial parent duration comes from its imported video. A different-duration replacement must present the confirmed duration choice before changing the timeline length. Effects of adopting a longer child or parent duration on neighboring placements remain Open. The scene/shot domain mapping above is a proposal; the parent/child relationship itself is Confirmed.

Figma examples include Storyboard, Blocking, Animatics, Complete, V1, and V2. A main-screen label appears as Animations. Layer creation and renaming are Confirmed; these observed labels do not restrict users to a fixed layer list. Default presets and any additional stage metadata remain Open.

### Proposed invariants

- Establish parentage from filename matching for an empty new layer, or from the chosen dashed cell for an existing layer, then persist stable parent/layer IDs. Renaming a layer or clip later must not silently break or rematch that ownership.
- For a parent displacement of `delta`, move every child by the same `delta`; preserve child offsets, durations, source ranges, and version references.
- Preserve parent order during Snap All. Manual parent movement should also carry children; this extension is Proposed.
- Never silently detach children, discard inactive versions, or mutate originals.
- Use frame-based or integer media times with an explicit frame rate/timebase. Avoid accumulated rounded seconds as authoritative positions.
- Group operations are atomic. A locked or unauthorized affected child should block the whole operation rather than leaving children behind; the lock policy requires review.
- Whether children may extend outside their parent or overlap another parent's children is Open.

### Magnet example

Using half-open frame ranges, parent A occupies `[0, 100)` and parent B occupies `[130, 230)`. B has a child starting at frame 140. Closing the 30-frame gap moves B to frame 100 and the child to frame 110. The child's offset remains 10 frames. Its source range and duration do not change.

## 8. Editing toolbar

All ten actions are Confirmed. Detailed rules labeled Proposed remain reviewable decisions.

| Action | Behavior |
| --- | --- |
| Delete | Confirmed: remove the selected timeline item; deleting a parent also removes all its children. Proposed: perform the whole group deletion as one undoable action while retaining source media/version history. |
| Undo | Reverse the most recent eligible edit. Proposed: a parent-group operation or Snap All is one step; undo must not overwrite another user's unrelated changes. |
| Redo | Reapply the last undone eligible edit. Proposed: a new edit clears that redo branch; conflicts require resynchronization. |
| Split | Confirmed: split the selected video at the playhead; splitting a parent also splits all its children at the same timeline position. Proposed: preserve source continuity and reject edge/out-of-range parent splits. Children crossing the cut divide between the resulting parents; a child wholly on one side stays intact with that side. |
| Delete Left | Confirmed: trim the selected video before the playhead and retain the later portion. Trimming a parent applies the same cut to all its children. Proposed: surviving frames retain their timeline positions and unrelated parent groups do not ripple. |
| Delete Right | Confirmed: trim the selected video after the playhead and retain the earlier portion. Trimming a parent applies the same cut to all its children. Proposed: retain the timeline start and do not ripple unrelated parent groups. |
| Add Video to Right | Confirmed: add a parent to the right when the parent layer is selected, or add a child to the right on the selected upper layer. Preserve the command's selected destination; the automatic filename rule for an empty new layer does not relocate an explicitly placed clip. Placement conflicts and insufficient-space rules remain Open. |
| Add Video to Left | Confirmed: mirror the right-side command on the left, with parent/child creation determined by the selected layer. Preserve the selected destination. Placement conflicts remain Open. |
| Enable/Disable Snap | Toggle snapping during movement/trimming. Proposed targets include the playhead and visible clip boundaries. Toggling alone never moves existing media. Default state, targets, and tolerance are Open. |
| Snap All / Magnet | Confirmed: compact the parent layer and carry corresponding children with their parent. Proposed: preserve order, keep the first parent in place, close subsequent gaps, and make the command atomic and undoable. First-parent anchoring and overlap handling are Open. |

### Shared editing rules

- Disable ineligible actions with an explanation: missing selection, permission, valid media, or eligible playhead position.
- Edits change timeline decisions; they do not re-encode or overwrite originals.
- Use one boundary convention for Split and directional trims. Proposed: the playhead is a boundary; the right-hand split includes the frame beginning there.
- Never create zero-length clips, negative timeline times, or source ranges outside the referenced version.
- Proposed boundary handling for grouped edits: split only children whose ranges cross the cut; assign children wholly on one side to that resulting parent without fabricating an empty segment. Directional trims retain the intersection of each child's range with the retained side. Remove a placement if no frames survive, while retaining its source version and feedback history. This handles unequal child lengths without changing the confirmed shared-cut rule.
- An ordinary Delete leaves a gap under the proposed default. Snap All is the explicit gap-removal action unless a separate ripple rule is approved.
- Feedback keeps its immutable version/source-time reference after edits. Context outside a new visible range remains identifiable rather than being dropped or reassigned.
- Multi-selection, marquee selection, and keyboard shortcuts are not confirmed by this request. Define them before presenting them as supported.

## 9. Playback, media, stages, and versions

### Confirmed playback rules

- Evaluate visible layers from top to bottom at every playhead position. Display the first layer containing a video clip covering that position.
- Skip hidden layers and visible layers with no video at that position.
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
- Preload Video must show what is being prepared and how much. It must not imply unlimited memory use or offline availability.

### Drag-and-drop intake and filename ordering

Confirmed:

- A new project starts with an empty timeline. Clips are uploaded by dragging files into it.
- Automatically arrange imported clips by name, for example `01_01` followed by `01_02`, regardless of the order in which the files were selected or dragged.
- When children are dropped into an empty new layer, match their names to parent-card names and align them automatically.
- When a child is dropped onto a dashed cell in an existing layer, place it in that cell. The user's destination takes precedence over filename matching, including when the filename matches a different parent.
- Example: dropping `01_02` into the dashed cell corresponding to parent `01_01` on an existing upper layer leaves it in the chosen `01_01` cell. Do not move it to `01_02` automatically.

Proposed details:

- Support both individual files and batches. Show the intended destination and import order before committing a drop.
- Parse scene/shot numbers for natural numeric ordering, so `01_2` sorts before `01_10`. Ignore the file extension for matching. Exact suffix handling, duplicate names, and unmatched names require an agreed policy.
- For an empty new layer, match names during intake and save stable relationships afterwards. For an existing-layer cell drop, save that cell's ownership and placement instead. Do not repeatedly reassign children when display names change.
- For the first parent-layer batch, place clips consecutively in filename order using their imported durations. The exact insertion policy for later batches must preserve deliberate existing edits unless the user chooses to rearrange them; this is Proposed.
- Preserve automatic ordering/matching for an empty new layer and explicit cell destinations for an existing layer while uploads finish out of order. A slow upload must not accidentally change the intended layout.
- Show import progress and allow failed files to be retried without duplicating successful placements or versions.
- During filename matching into an empty new layer, keep unmatched or ambiguous files visible for resolution rather than silently attaching them to the wrong parent. Whether to create a missing parent automatically is Open. A deliberate existing-layer cell drop does not require a filename match.

### Contextual drop targets

These three outcomes are Confirmed. The drop destination, rather than a separate upload mode, selects the action.

| Drop destination | Result | Preview |
| --- | --- | --- |
| An existing clip on any layer, including the parent layer | Add a new version to that clip. Do not create a separate neighboring clip or layer. | Show `v2` over a clip that currently has V1, indicating the impending new version. Proposed: show the next version number for later replacements. |
| A dashed empty cell within an existing layer | Add a clip in the cell chosen by the user. Do not sort or relocate this explicit placement by filename. On an upper layer, the cell supplies the parent association. | Highlight the exact target cell and intended placement. Do not show the version-creation preview. |
| Blank space above a layer, outside existing clip/row drop targets | Create a layer at that location, named exactly `new layer`, and place the dropped clips in it. For this empty new upper layer, match and align children to parents by filename. The layer can be renamed. | Indicate the new-row insertion position and filename-based placements. |

Proposed interaction safeguards:

- Keep row, clip, and new-layer insertion targets visually distinct. Update the preview as the pointer crosses between them; canceling the drag changes nothing.
- Classify an explicit drop onto a clip as version creation before considering blank-row placement. A filename mismatch against that target needs a clear resolution policy; do not silently create an unrelated parent.
- Finalize a new version only after upload/validation and any required duration decision, preserving older versions. Proposed default: make it active when ready and the duration decision is resolved; do not interrupt the existing version merely by hovering or beginning an upload.
- A failed new-layer drop must not leave an unexplained empty layer; a failed version upload must preserve the previous usable version.
- Batch drops onto a single existing clip still require an explicit policy before implementation.

### Different-duration version prompt

Confirmed:

- Compare the replacement version's duration with the existing timeline clip length. If they differ, ask before applying a length change.
- Offer **Adopt New Duration** and **Keep Existing Length**. Apply the choice to the target clip instead of silently resizing or preserving it.
- The prompt applies to version replacement on any layer, including a parent clip.

Proposed interaction details:

- Show both durations using the project time display so the effect of the choice is clear.
- Wait until media metadata is available before asking. Do not move neighboring clips or resize the target merely because an upload starts.
- Provide Cancel; canceling leaves the active version and timeline placement unchanged.
- Keep Existing Length preserves the placement's timeline boundaries. How to display any uncovered tail when the new source is shorter remains Open; the choice must not silently assume looping, stretching, or a frozen frame.
- Adopt New Duration uses the new duration. Effects on child ranges, parent duration, collisions, and neighboring groups require the remaining timing rules; the prompt itself does not imply ripple movement.

## 10. Feedback, information, and activity

### Feedback

Observed: drawing, text, and microphone controls with D/T/V hints; All Shots/Active Shot; All/Pending/Done/Approved filters; feedback cards with author, time, context, replies, and status controls.

### Timeline feedback pins

Confirmed:

- Show a pin at the timeline position where feedback was given. The design places these markers above the corresponding upper-layer clips.
- Color pins according to the feedback author. Author identity, rather than feedback status or stage, determines their color.

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
- Proposed review flow: Pending -> Done -> Approved, plus explicit reopen. Approval authority/transitions remain Open.
- D/T/V are observed hints; shortcut bindings require review and must not trigger while typing.

### Info and Edit

The tabs are Observed, but their complete forms are not supplied. Proposed Info fields: scene/shot ID, stage, version, uploader/time, duration, source frame rate/dimensions, active-version state, and processing status.

Proposed Edit fields: shot label, parent duration, child source in/out, stage assignment, version activation. Duration and ownership changes must obey the approved hierarchy rules. The nearby Date needed annotation suggests a possible field; it does not establish an assignment/date workflow.

### Activity and KHP tasks

- Show significant committed uploads, edits, activation, feedback, and approval changes with actor, resource, and time.
- Apply the observed activity filters, with pagination or incremental loading.
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

The initial capacity requirement is five simultaneous SceneFlow users, as recorded in the architecture document. It is not a claim that this scaffold currently implements shared editing.

## 12. Acceptance criteria

Proposed criteria depend on product review; Confirmed criteria reflect the user's instructions.

| ID | Acceptance condition | Status |
| --- | --- | --- |
| SF-01 | All ten toolbar actions are identifiable beside playback controls. | Confirmed |
| SF-02 | Delete Left trims the selected video's earlier portion at the playhead. When the selection is a parent, all its children receive the same timeline cut; unrelated parent groups are not deleted. | Confirmed |
| SF-03 | Delete Right trims the selected video's later portion at the playhead. When the selection is a parent, all its children receive the same timeline cut; unrelated parent groups are not deleted. | Confirmed |
| SF-04 | Snap All compacts parents and moves corresponding children by their parent's displacement, preserving offsets and media ranges. | Confirmed |
| SF-05 | Snap All preserves order and the first-parent anchor; one Undo/Redo restores/reapplies the whole grouped edit. | Proposed |
| SF-06 | A blocked child prevents an entire grouped edit; no partial parent/sibling movement occurs. | Proposed |
| SF-07 | Splitting a parent also splits all its children at the same timeline playhead position. | Confirmed |
| SF-08 | Add Left/Right creates a parent on the parent layer or a child on the selected upper layer at the selected relative destination. | Confirmed |
| SF-09 | Snap toggle changes subsequent interaction behavior without immediately moving existing media. | Proposed |
| SF-10 | Deleting a parent removes all its child placements. | Confirmed |
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
| SF-21 | Feedback pins identify feedback positions on the corresponding clips and use the feedback author's color. | Confirmed |
| SF-22 | Clicking a pin seeks to its exact context and opens the matching feedback; author identity is available without relying on color alone. | Proposed |
| SF-23 | Parent movement carries children and their feedback pins. A split does not duplicate feedback; a trimmed-out anchor remains available in version/history context. | Proposed |
| SF-24 | Grouped cuts preserve source continuity and valid durations; children wholly outside the retained side follow the explicit boundary rule without creating empty clips. | Proposed |
| SF-25 | A newly created project has an empty timeline and accepts clips through drag-and-drop upload. | Confirmed |
| SF-26 | An initial automatic import of `01_02` and `01_01` orders them as `01_01`, then `01_02`. This does not override explicit existing-layer cell drops. | Confirmed |
| SF-27 | Children dropped into an empty new layer link and align to matching parent cards by filename. | Confirmed |
| SF-28 | Hovering a dragged file over a V1 clip shows `v2`; dropping it there creates a new version of that clip on the same layer. | Confirmed |
| SF-29 | Dropping onto a dashed cell in an existing layer places the clip in that chosen cell, without creating a version or another layer and without relocating it by filename. | Confirmed |
| SF-30 | Dropping into blank space above a layer creates a layer at that position named `new layer`; the user can rename it. | Confirmed |
| SF-31 | Drop previews distinguish new clips, versions, and new layers; canceling a drag causes no timeline mutation. | Proposed |
| SF-32 | An upper clip covering seconds zero to six reveals a lower visible clip covering zero to ten for seconds six to ten. A hidden upper layer never covers lower video. | Confirmed |
| SF-33 | Different upload completion orders preserve filename-based placement for empty new layers and user-chosen cells for existing layers. A failed version upload leaves the previous version usable. | Proposed |
| SF-34 | Undoing a parent deletion restores the whole group; source media and version history survive placement deletion. | Proposed |
| SF-35 | Dropping `01_02` onto an existing upper layer's dashed cell for parent `01_01` keeps the chosen destination and parent association. | Confirmed |
| SF-36 | A different-duration replacement prompts for Adopt New Duration or Keep Existing Length before applying the choice; neither outcome is selected silently. | Confirmed |
| SF-37 | The duration prompt shows both lengths; Cancel leaves the active version and timeline placement unchanged. | Proposed |

### Proposed performance validation

Agree on project sizes, footage, browsers, and representative networks before the pilot. The platform proposal suggests five simultaneous users, proxy playback startup p95 under three seconds, warm seeks p95 under one second, and no lost acknowledged edits. These are untested objectives dependent on the media pipeline and actual NAS/network conditions. Timeline interaction targets and project-size limits remain to be defined.

## 13. Proposed delivery slices

| Slice | Outcome | Completion evidence |
| --- | --- | --- |
| 0. Foundation | Next.js app in the requested directory and reviewable PRD. | Build/lint/typecheck results and product review. |
| 1. Workspace and hierarchy | Figma-based shell with an empty default timeline, layer creation/renaming, drop previews, filename ordering/matching, and visible-layer playback. An optional sample project must be explicitly selected. | Visual review plus verified drop classification, matching, hierarchy, and playback fallback. |
| 2. Editing | All ten tools, version drops, and approved trim, split, insertion, magnet, lock, and undo rules. | Acceptance checks including grouped edits, parent deletion, and child-offset preservation. |
| 3. Shared foundation | Authorized NAS media, versions, durable saves, and conflict recovery. | Refresh/reconnect, permissions, media, and concurrency checks. |
| 4. Review and integration | Feedback, activity filters, approval, KHP task links. | End-to-end review with multiple authorized users. |
| 5. Pilot | Production-sized projects, five-user evaluation, recovery, deployment readiness. | Recorded pilot results and resolved operational dependencies. |

These are outcome slices, not authorization to implement all product features now. The shared backend/media foundation remains a dependency.

## 14. Open decisions before implementation

| Priority | Decision | Why it matters |
| --- | --- | --- |
| 1 | If Keep Existing Length is chosen for a shorter source, how is the uncovered tail displayed? If Adopt New Duration changes group boundaries, how do children and neighboring groups respond? Review the proposed activation default. | Completes timing edge cases. The prompt and its two choices are already confirmed. |
| 2 | For filename matching into an empty new layer, how should suffixes and unmatched/duplicate names be handled? What should multiple files dropped onto one existing clip do? | Completes automatic matching and batch-version intake. Existing dashed-cell placement already overrides filename matching. |
| 3 | How should left/right insertion collisions, child overhangs, and later batches added to the parent layer be handled? | Completes placement edge cases without reopening the confirmed manual cell-drop rule. |
| 4 | Does Snap All leave the first parent in place or move it to zero? How are overlaps and locked children handled? | Completes compaction and atomicity rules. |
| 5 | Review grouped-cut handling for children wholly on one side of a cut. Which layer presets or stage metadata are useful beyond the confirmed creation/renaming behavior? | Completes editing edge cases and optional presets. Layer playback precedence is already confirmed. |
| 6 | What are the frame rate/time display, previous/next navigation, snap targets, and shortcuts? | Defines precise interactions. |
| 7 | Who can approve/reopen feedback, which Info/Edit fields are required, and where are KHP tasks created? | Completes review and task integration. |
| 8 | Are rendered exports, independent audio tracks, or mixing needed in the first release? What do overview colors represent? | Changes release scope and media requirements. |

## 15. Calls left to the builder

After product approval, the implementer may choose ordinary component boundaries, state organization, design tokens, rendering optimizations, and test tooling within the approved behavior/platform constraints. New domain behavior, changed hierarchy guarantees, cloud media delivery, or a different backend/authentication strategy require a product or architecture decision.

Next: resolve the highest-priority editing decisions, revise this PRD, obtain product approval, and prepare a detailed implementation plan.
