# SceneFlow frontend implementation plan

Build the approved local review workflow in `apps/sceneflow-web` using the [Scene Flow design frame](https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=28-3) and [product requirements](../specs/2026-11-19-sceneflow-prd.md).

1. Match the desktop frame’s header, activity filters, landscape viewer, editing controls, timeline and tabbed inspector. Open an empty timeline on first use.
2. Implement layered placements, file imports, versions, shot metadata, selection, edit commands, frame navigation, undo and checkpoints.
3. Connect playback, local media preparation and export to the same visible-layer and source-time rules.
4. Implement text, voice and drawing feedback, version-aware pins, statuses, activity filters and uploader notifications with local reviewer identities.
5. Store project metadata and media in the browser. Verify the build, timeline operations, import, playback, persistence, feedback and output files before handing over the preview.

Frontend scope includes browser-local test identities. Shared KHP authentication, server permissions, multi-user delivery and NAS media services belong to a later integration.

