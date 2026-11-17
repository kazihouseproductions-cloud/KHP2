# KHP Platform Architecture: Shared .NET Backend, Authentication, Database, and NAS Video Delivery

Date: 17 November 2026  
Status: Architecture proposal for review; no application code or NAS configuration has been changed.  
Audience: The team maintaining KHP, Moodboard, SceneFlow, and the shared Assets Library.

## 1. Decisions and evidence

The recommended architecture is three frontend applications, one modular ASP.NET Core business API, one PostgreSQL database, a resumable upload gateway, a protected media file server, and one background worker. All application hosting, video storage, conversion, and delivery remain on the NAS for the initial deployment.

### Confirmed requirements

| Item | User requirement or supplied information |
| --- | --- |
| Applications | KHP, Moodboard, and SceneFlow; Assets Library is shared across them. |
| Ownership | One team maintains all applications. |
| Authentication | Start by logging into KHP, then navigate to other applications without another login. |
| Integration | Moodboard and SceneFlow can create tasks owned by KHP. |
| Hosting | Synology NAS. |
| Hardware | User reported DS923 with 8 GB RAM. This plan interprets the model as DS923+; verify the exact model and DSM version before deployment. |
| SceneFlow concurrency | Initially five people viewing and editing simultaneously. Other applications can also issue ordinary API requests. |
| Internet | User reported an Ookla result of 814 Mbps download and 939 Mbps upload at the NAS location. This is a supplied speed-test result, not a measurement performed by this review. |
| Video location | All video storage and delivery must remain on the NAS. No cloud video storage, CDN, or cloud transcoding is part of this design. |

Synology lists the DS923+ with an AMD Ryzen R1600, two CPU cores and four threads. This is relevant to conversion throughput, which is a different workload from serving existing video files. Plan for software video encoding until an actual supported hardware encoder has been identified and tested; do not assume Intel Quick Sync on this AMD platform. [Synology DS923+ data sheet](https://global.download.synology.com/download/Document/Hardware/DataSheet/DiskStation/23-year/DS923%2B/enu/Synology_DS923%2B_Data_Sheet_enu.pdf)

### Proposed defaults

The following are design recommendations, not additional requirements already approved by the user:

- ASP.NET Core on .NET 10 LTS, with current supported patches when implemented.
- PostgreSQL 18 with EF Core and its compatible Npgsql provider; resolve matching supported package versions during implementation.
- One public HTTPS origin for the three interfaces, API, authentication, uploads, and media.
- ASP.NET Core Identity and a shared cookie session; no separate identity-provider container initially.
- Pre-generated H.264/AAC editing proxies and adaptive review video.
- One background conversion at a time, with CPU and memory limits.
- A same-origin Nginx gateway for routing and authorized file delivery; DSM provides the outer HTTPS entry point.
- Persistent PostgreSQL jobs rather than a separate message broker initially.

.NET 10 is an active LTS release according to Microsoft's support policy. PostgreSQL schemas organize data inside a database, and Npgsql supplies an EF Core PostgreSQL provider. These choices do not imply unlimited capacity. [Microsoft support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core), [PostgreSQL schemas](https://www.postgresql.org/docs/current/ddl-schemas.html), [Npgsql provider](https://www.npgsql.org/efcore/)

### Current repository state

The reviewed workspace is the existing KHP Next.js application, using Next.js 16.4.5, TypeScript, React, and Zustand. Tasks, boards, members, attendance, and work hours currently persist in browser local storage; chat uses IndexedDB and browser BroadcastChannel updates. There is no .NET solution or server database implementation in the reviewed repository.

The architecture below is therefore a new server foundation and data migration, not a change to an existing production .NET backend. Existing browser profile passwords and browser-selected members are not server identity credentials.

## 2. Intent, boundaries, and alternatives

The goal is to give the three products a consistent account system, workspace permissions, asset ownership, and integration contracts while supporting five simultaneous SceneFlow users with responsive editing and playback.

The initial architecture does not promise zero buffering on every international connection. It does not include offline collaborative merging, unrestricted public developer access, multiple regions, a high-availability NAS cluster, or real-time encoding for each viewer. Those require separate decisions.

| Approach | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| One modular .NET business API | Shared identity and transactions; consistent permissions; fewer independently managed services for one team. | A backend rollout or process outage affects all three products; modules share CPU and database resources. | Recommended initial architecture. |
| Three independent business APIs | Independent deployments and resource allocation for each product. | More integration, authentication configuration, version coordination, and failure handling. Does not add CPU or RAM when all run on the same NAS. | Keep as a later extraction option. |
| Full-stack Next.js business backend | One primary application language and reuse of current skills. | Still needs deliberate shared domain boundaries, media workers, and collaboration infrastructure. | Technically viable; the proposed .NET platform provides the desired shared backend foundation. |

The user has requested the shared .NET architecture. Video delivery is explicitly NAS-only; a CDN proposal is excluded even though edge delivery could reduce long-distance latency. One API application can later have several running instances. A single deployment and internal separation of modules are compatible concepts. [Microsoft application architecture guidance](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)

## 3. Runtime topology

The following names are illustrative routes under a domain the team controls, not actual configured addresses.

```text
Browser users in any country
          |
          | HTTPS to studio.example.com
          v
Synology HTTPS reverse proxy
          |
          v
Platform Nginx gateway
    | /khp/*              -> KHP frontend
    | /moodboard/*        -> Moodboard frontend
    | /sceneflow/*        -> SceneFlow frontend
    | /auth/*             -> Shared .NET authentication endpoints
    | /api/v1/*           -> Shared .NET business API
    | /hubs/*             -> SignalR in the shared .NET host
    | /uploads/*          -> Resumable upload gateway
    | /media/*            -> Authorized NAS file reads
    |
    | small internal authorization subrequests
    +--------------------> Shared .NET API

Shared .NET API -------> PostgreSQL
Upload gateway --------> NAS upload staging
Media worker <--------> PostgreSQL durable jobs
Media worker ----------> NAS originals and generated derivatives
Nginx media server ----> NAS files through read-only mounts
```

The business API handles metadata, permissions, document changes, and job requests. It does not relay complete video uploads, stream video bytes through application memory, or run FFmpeg inside HTTP request handlers.

The upload gateway and media server are infrastructure components, not three separate product backends. The worker shares domain contracts with the API but runs in a separate process so its resource usage and lifecycle can be controlled.

Use one public application port, HTTPS 443. Keep PostgreSQL, internal authorization endpoints, worker control, and container management private. DSM administration must use a separate administrative route and access policy. Verify externally reachable networking and public certificate renewal before launch; the Ookla result does not establish inbound reachability or rule out CGNAT.

Do not base the video transport on a third-party HTTP tunnel or cloud relay. Confirm that the chosen remote-access route reaches the NAS directly. Container Manager availability and image architecture must be verified for the actual NAS and DSM version. [Synology Container Manager](https://www.synology.com/en-uk/dsm/packages/ContainerManager)

## 4. Backend modules and ownership

| Module | Responsibilities | Primary operations |
| --- | --- | --- |
| Accounts | Identity users, invitations, login, password reset, sessions, security stamps, optional MFA. | Sign in, sign out, inspect/revoke sessions. |
| Workspaces | Organizations, workspaces, memberships, resource grants, application access. | Resolve a user's access to a specific workspace or resource. |
| KHP | Tasks, statuses, assignments, schedules, attendance, work hours, task history. | Create or change tasks, query boards and reports. |
| Moodboard | Boards, elements, comments, revisions, asset references. | Apply board operations, query board state and history. |
| SceneFlow | Projects, sequences, tracks, clips, source references, timeline revisions. | Apply timeline operations, request renders and exports. |
| Assets | Asset versions, storage locations, technical metadata, upload sessions, derivatives, media authorization. | Register uploads, authorize media, retrieve derivative status. |
| Notifications | User notifications and the activity read model. | Query and acknowledge notifications; broadcast relevant updates. |
| Jobs | Durable work records, leases, retries, dead-letter state, transactional outbox. | Claim work, report progress, retry or fail a job. |

Each module has its own persistence mappings, migrations, application interfaces, and tests. No frontend reaches PostgreSQL directly. A module does not write another module's tables through arbitrary SQL or a shared generic repository.

Use small explicit contracts such as task creation, asset authorization, and workspace access checks. Shared code should be limited to primitives such as IDs, clocks, error contracts, and job envelopes; domain rules remain in their owning module.

Regular tasks, attendance, and metadata use normal request/response operations. CPU-intensive conversions and exports use durable jobs and return a job identifier promptly.

### Cross-application task creation

Proposed external endpoint: `POST /api/v1/khp/tasks`.

A request includes the authorized workspace, task fields, an idempotency key, and an optional source reference: application, resource ID, and resource version. The backend establishes the actor from the authenticated session, not a caller-supplied user ID.

- A browser action in Moodboard or SceneFlow calls the shared KHP endpoint.
- A server-side action in another module invokes the KHP application interface internally; it does not make an HTTP request to its own public host.
- KHP validates workspace membership, task permissions, assignment eligibility, and the source reference.
- Reusing the same idempotency key with the same request returns the original result. Reusing it with different request content is rejected.
- If task creation must happen asynchronously after a committed domain change, save a durable outbox record in the same database transaction as that change. The consumer retries safely using the operation's unique ID. Do not promise exactly-once execution.

For immediate workflows needing all-or-nothing behavior, an explicit application coordinator may call module interfaces in one PostgreSQL transaction. Keep that coupling named and tested. Asynchronous workflows must expose pending or failed integration status. [Transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

## 5. Repository and project structure

```text
khp-platform/
  apps/
    khp-web/                         # Existing frontend, moved only by a later migration task
    moodboard-web/
    sceneflow-web/
  packages/
    ui/                              # Shared design components
    api-client/                      # Generated TypeScript client from OpenAPI
  backend/
    Platform.sln
    src/
      Platform.Api/                  # Composition, HTTP endpoints, Identity, SignalR
      Platform.Contracts/            # Small public module and API contracts
      Modules/
        Accounts/
        Workspaces/
        Khp/
        Moodboard/
        SceneFlow/
        Assets/
        Notifications/
        Jobs/
      Platform.Worker/               # Durable jobs and FFmpeg process orchestration
    tests/
      ModuleTests/
      IntegrationTests/
      AuthorizationTests/
      MediaPipelineTests/
  infrastructure/
    gateway/                         # Routing, internal auth, range requests
    uploads/                         # Resumable upload gateway configuration
    compose/                         # NAS deployment definition and resource limits
    observability/                   # Small health and log collection configuration
  docs/
    architecture/
    operations/
    api/
```

Within each module, organize features around application operations, domain types, persistence, and endpoint adapters. Do not create dozens of empty projects before there is useful code to separate. Use architecture checks to prevent accidental cross-module persistence access.

Keep the existing KHP repository in place until a dedicated migration task preserves its history and build behavior. This document does not perform that move. Build frontend and backend release images on a development machine or CI, not on the 8 GB NAS. Configure each frontend's base path and generated asset URLs consistently before deployment.

## 6. Database architecture

Start with one PostgreSQL instance and one `platform` application database. Use schemas for logical ownership:

| Schema | Initial entities |
| --- | --- |
| `accounts` | Identity tables, invitations, server sessions, recovery/security records. |
| `platform` | Organizations, workspaces, memberships, resource grants, application access. |
| `khp` | Tasks, assignments, statuses, attendance, work schedules, task history, task source links. |
| `moodboard` | Boards, elements, document operations, revisions, comments, asset links. |
| `sceneflow` | Projects, sequences, tracks, clips, document operations, revisions, export requests. |
| `assets` | Assets, immutable versions, file locations, technical metadata, derivatives, upload sessions. |
| `notifications` | Notification records and activity projections. |
| `jobs` | Jobs, attempts, leases, outbox records, integration deduplication records. |

Schemas are logical boundaries, not isolated databases or complete security boundaries. Keep module ownership in the application and migration design. Use a restricted runtime database role and a separate migration role; do not run the application as a PostgreSQL superuser.

### Core relationships

- One account can belong to several workspaces through memberships.
- Every protected business root has an owning workspace.
- A KHP task may reference a Moodboard board/element or SceneFlow project/clip through a typed source link.
- An asset has immutable versions. Boards and timeline clips reference the exact asset version they use.
- An asset version has zero or more derivatives and storage location records.
- A derivative records its profile revision, dimensions, codec, bitrate, duration, byte count, checksum, and readiness state.
- Each document operation has an operation ID, actor, document ID, expected revision, assigned server sequence, and payload.
- Jobs refer to immutable input versions and an encoding/render profile version.

Use foreign keys for stable platform and asset identities, and composite keys or constraints that prevent workspace mismatches. Cross-module application workflows still use module interfaces; database constraints provide an additional integrity check. Typed source links to optional product-specific entities are validated by their owning module and handled explicitly when the source is deleted.

### Data representation and concurrency

Use UUID primary keys, UTC timestamps, explicit workspace IDs, and an integer or equivalent optimistic concurrency revision on mutable aggregates. A stale task or timeline change produces a conflict response with the current revision rather than silently overwriting another user's work.

Represent media times with integer timestamps in a defined timescale and record rational source frame rates. Do not use rounded floating-point seconds as the authoritative frame or clip position. Timeline edit decisions are metadata; edits do not repeatedly rewrite the original video.

Use relational columns for identity, ownership, task filtering, and asset metadata. JSONB is appropriate for versioned document snapshots and typed operation payloads, with limits on size and shape. Do not store the authoritative state of an entire large workspace in one mutable JSON document.

Store media bytes in NAS files, not PostgreSQL byte arrays or base64 text. PostgreSQL stores their identifiers, metadata, permissions, checksums, and lifecycle state.

Index common access patterns such as `(workspace_id, status, updated_at)`, membership lookups, document operation sequence, asset version references, and available job leases. Paginate list endpoints and build explicit dashboard read models instead of downloading every task to calculate aggregates in the browser.

### Connections and migrations

Use bounded Npgsql connection pooling. An initial proposal is an API pool maximum of 20 and a worker maximum of 5, with a PostgreSQL connection limit that leaves room for maintenance and migrations. These are starting configuration proposals, not performance findings; validate them under the workload test. Do not open a new unbounded pool per request or create a connection per SignalR client.

Apply reviewed migrations through one release job, not concurrently from every API instance. Use expand/migrate/contract changes so an application rollback remains possible. Back up before destructive schema changes.

## 7. Authentication and authorization

### Initial deployment: one origin, one session

Use ASP.NET Core Identity for account management and ASP.NET Core cookie authentication in the shared backend. This supplies established password and account handling without building a password system from scratch. Identity can manage users, passwords, roles, claims, and account recovery; it is not itself a full OpenID Connect identity provider. [ASP.NET Core Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity?view=aspnetcore-10.0)

The three interfaces use the same origin, for example:

```text
https://studio.example.com/khp/
https://studio.example.com/moodboard/
https://studio.example.com/sceneflow/
https://studio.example.com/auth/
https://studio.example.com/api/v1/
```

1. The user opens KHP and submits credentials to the shared authentication endpoints.
2. The backend validates the account, optional MFA, and account state.
3. The backend establishes a server session and returns a Secure, HttpOnly, host-only authentication cookie with `Path=/` and an appropriate SameSite policy.
4. Requests from all three applications carry that cookie automatically to the same backend.
5. Navigating to another application uses the same session and does not ask for another password.
6. Logout revokes the server session and clears the shared cookie. Password/security changes can revoke all sessions.

Proposed policy: an eight-hour idle session limit and a seven-day absolute maximum, with the exact production policy confirmed before launch. Store a session identifier in the protected ticket and maintain the active session record in PostgreSQL. Keep short bounded authorization/session caches; explicit revocation must become effective across new requests within five seconds in the initial single-instance design. Already downloaded video bytes cannot be revoked.

Revocation also applies to already connected SignalR clients. Maintain a server connection registry linking connection IDs to sessions, users, and document groups. A session or membership revocation writes a durable access-change event and triggers immediate removal of affected group memberships and connection closure through the connection lifecycle coordinator. A lightweight coordinator in the API also reconciles active access revisions at least once per second, using authorization caches no older than one second, so a failed immediate notification cannot leave a live connection authorized indefinitely. Every hub command rechecks current session/resource authority; the connection handshake and group name are not sufficient authorization. Stop outbound delivery to revoked connections and verify the same five-second maximum under pilot load. Sending a client-side logout message alone does not enforce revocation.

Use antiforgery protection for cookie-authenticated state-changing operations, including login/logout, upload creation, and administrative changes. Validate allowed origins on WebSocket/SignalR and upload requests. SameSite is an additional measure, not a replacement for antiforgery validation. Keep passwords and access credentials out of local storage. [ASP.NET Core antiforgery guidance](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0)

Persist and back up the ASP.NET Core Data Protection key ring outside the container filesystem, protect its access, and use a stable application identity. Recreating an API container must not invalidate all cookies merely because its encryption keys disappeared. [Data Protection configuration](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0)

For the first deployment, use administrator-issued invitations, no open public registration, and require MFA for administrative accounts. Recovery codes and password reset endpoints must use supported Identity mechanisms and a configured delivery/recovery process. Choosing an email delivery service is an operational decision; it does not change the NAS-only video requirement.

### Authorization is separate from login

Use workspace roles such as Owner, Administrator, Editor, Reviewer, and Viewer as proposed defaults. Express operations as policies, for example `Task.Create`, `Board.Edit`, `Timeline.Edit`, `Asset.Upload`, `Asset.View`, `Asset.DownloadOriginal`, and `Workspace.ManageMembers`.

Resolve the current account from the session, verify workspace membership, then verify the specific resource and operation. A user being logged into KHP does not grant access to every project or original video. Resource IDs, filenames, actor IDs, and workspace IDs supplied by a browser are untrusted input.

All three interfaces share the same browser origin and trust boundary. Keep user-uploaded HTML/SVG and other potentially executable content from running as active same-origin application content; provide sanitized previews or attachment downloads. A later requirement to isolate apps from one another may justify separate origins.

If the products later need separate domains, mobile clients, or external customer integrations, add a standards-based OIDC provider and OAuth authorization flows. Do not try to convert the shared cookie into cross-domain identity by copying tokens or placing them in URLs. That is a future identity expansion, not required to deliver the current login-once behavior. [ASP.NET Core OIDC guidance](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-oidc-web-authentication?view=aspnetcore-10.0)

## 8. Video storage and upload lifecycle

### Files and metadata

Choose a new dedicated application share before deployment. The following is a proposed layout, not an existing path or permission to change any current NAS application:

```text
/volume1/<chosen-share>/khp-platform/
  postgres/
  identity-keys/
  media/
    staging/<upload-session-id>/
    originals/<workspace-id>/<asset-id>/<asset-version-id>/source.ext
    derivatives/<workspace-id>/<asset-version-id>/<profile-revision>/
      editor/540p.mp4
      editor/720p.mp4
      review/<publication-revision>/master.m3u8
      review/<publication-revision>/480p/...
      review/<publication-revision>/720p/...
      review/<publication-revision>/1080p/...
      thumbnails/...
      waveform/...
    exports/<workspace-id>/<export-id>/...
  worker-scratch/
  backups/
```

IDs, not original filenames, determine physical paths. Record the original filename as metadata. Originals are immutable and retained for final rendering, future re-encoding, and authorized download. Optimized derivatives can be regenerated. An uploaded replacement creates a new asset version rather than overwriting a version used in an existing edit.

### Upload flow

1. SceneFlow requests an upload session from `POST /api/v1/assets/upload-sessions`, with workspace, filename, size, and intended use.
2. The API checks membership, upload permission, workspace storage quota, remaining disk space, and concurrent-upload policy. It reserves the declared bytes and returns an upload-session ID and scoped upload capability.
3. The browser sends the file directly to `/uploads/` through a resumable upload gateway. Use a maintained tus implementation with filesystem storage and authenticated hooks/integration. The business API does not receive the file body.
4. The gateway validates the session/capability, ownership, expiry, method, and resource path for creation, offset checks, chunk writes, and termination. Start with 8 MiB chunks and one active transfer per user; tune after measurement.
5. The file remains in staging until the server verifies the completed size and computes a trustworthy content checksum. A browser claim of completion is not sufficient.
6. A worker probes the actual media tracks, duration, dimensions, frame rate, rotation, audio, and color metadata. Unsupported or corrupted content becomes an explicit failed asset state; it is not exposed as a playable file.
7. After verification, atomically finalize the original within the same filesystem and commit its immutable metadata and processing jobs. Because filesystem changes and database commits are not one transaction, a reconciliation job must recover orphaned staged/finalized files and incomplete registrations safely.
8. Generate the first editing proxy and poster, then publish readiness for that derivative. Generate remaining review formats, thumbnails, and waveform according to priority.
9. Notify SceneFlow through SignalR and expose durable status through the API for reconnects.

The tus protocol supports resuming from a known upload offset; resumption and ownership must still be implemented and tested in the chosen gateway. [tus resumable upload protocol](https://tus.io/protocols/resumable-upload)

Proposed initial limits: 50 GiB per uploaded file, two simultaneous uploads platform-wide, unfinished upload cleanup after 48 hours of inactivity, and refusal of new uploads when less than 15% disk space remains. Make these explicit configuration values and confirm them against available storage and real source footage. Reserve space for temporary conversion outputs as well as the incoming source; a percentage check alone is insufficient. Finishing or resuming an existing upload must not bypass quota enforcement.

Suggested lifecycle states are `Uploading`, `Validating`, `OriginalReady`, `Processing`, `PartiallyReady`, `Ready`, `Failed`, and `Deleting`. Track each derivative separately so a failed optional 1080p encode does not hide a valid 540p editing proxy. Progress messages distinguish transfer completion from conversion completion.

## 9. Optimization for editing and review

The design has two distinct video use cases. Continuous review playback benefits from adaptive bitrate streaming. Timeline editing needs fast random access, stable source-time mapping, thumbnails, and low decoding cost. A single extremely compressed file does not optimize both.

### Preserve the source

Keep the original upload unchanged. Render/export jobs read the original asset versions and the recorded edit decisions. They must not export from low-resolution proxies. Preserve exact source duration and source-time mappings when generating proxies, especially for variable frame rate footage. Do not silently round task-linked or feedback-linked timestamps.

### Initial derivative profiles

The rates below are starting budgets for ordinary SDR footage, not guarantees for all visual content. Validate quality with actual animation, high motion, text, gradients, and source frame rates. Preserve aspect ratio, never upscale a lower-resolution source, and use measured peak rates when provisioning bandwidth.

| Derivative | Initial format and encoding target | Purpose |
| --- | --- | --- |
| Editor economy | H.264, 8-bit 4:2:0, 540p maximum height, approximately 1.0-1.8 Mbps video plus 96-128 kbps AAC audio. | Default remote editing and weaker clients. |
| Editor standard | H.264, 720p maximum height, approximately 2-3 Mbps video plus AAC audio. | Better detail while editing. |
| Review low | H.264/AAC HLS, up to 480p, approximately 0.8-1.4 Mbps video. | Lower-throughput fallback. |
| Review standard | H.264/AAC HLS, up to 720p, approximately 1.5-3 Mbps video. | Normal continuous review. |
| Review detail | Optional H.264/AAC HLS, up to 1080p, approximately 3-6 Mbps video. | Detail inspection when the source and link support it. |
| Supporting data | Poster, thumbnail sprite sheets/time index, and bounded-resolution audio waveform data. | Navigation without downloading/decoding the source. |

Use a measured capped bitrate or constrained quality profile so an unexpectedly complex scene does not generate uncontrolled network peaks. Frame rate, color conversion, profile, and bitrate caps are versioned encoding settings. Treat HDR-to-SDR preview conversion as an explicit, tested process; preserve the original HDR source for export.

For editor MP4s, place the MP4 index at the beginning using fast-start packaging, support HTTP range requests, and start with a short approximately one-second keyframe interval. Shorter GOPs improve seek opportunities but increase size; benchmark the tradeoff before finalizing the profile. Fast-start moves MP4 metadata to the front; it does not make every frame independently seekable. [FFmpeg format documentation](https://ffmpeg.org/ffmpeg-formats.html)

For review, use VOD HLS with fragmented MP4, initially four-second segments and aligned keyframes every two seconds across renditions. Publish a manifest only after every file it references exists. If another quality level is added later, publish a new immutable manifest revision. Test native HLS where available and a maintained MSE-based player elsewhere. Apple documents keyframe and frame-rate requirements useful to this packaging design. [Apple HLS authoring specification](https://developer.apple.com/streaming/hls-authoring-specification-for-apple-devices.html)

### Avoid unnecessary conversion on the DS923+

Create the default editor proxy first. When its encoding and keyframe properties meet the review profile, package that encoded stream into HLS without encoding it again. Queue optional extra resolutions only when needed or during low activity. Reuse compatible audio and thumbnails rather than generating duplicates for every project that references the same asset version.

Do not encode separately for each viewer and do not generate every possible resolution immediately. Five users can read the same pre-generated file without five encoder processes. There is no claimed conversion-time estimate until representative source files have been tested on the NAS.

### Browser behavior

- Start remote editors with the economy proxy and let users request more detail.
- Fetch media near the playhead and expected next clip; keep a bounded cache rather than downloading every source.
- Use generated thumbnails for scrubbing and waveform data for audio navigation.
- Cancel obsolete seeks and prefetches; do not launch an unbounded request for each mouse movement.
- Preserve source-to-proxy timestamps and frame-rate rational values so edits map correctly to the original.
- Limit simultaneously decoded layers and prefetch windows on weaker client machines. A transition or layered timeline can require more than one stream per editor.
- Keep assets in a browser-managed cache only under a clear bounded retention/logout policy appropriate to private project content. Revocation cannot erase bytes already downloaded to an untrusted device.

Smooth video delivery does not guarantee smooth timeline compositing. Device decoding capability, effects, canvas rendering, memory, and browser scheduling must also be profiled.

## 10. Authorized NAS media delivery

Serve media directly from a dedicated Nginx container through read-only file mounts. Use a build with its authorization subrequest module. The public `/media/` route makes a small internal authorization request to the .NET API; after approval, Nginx reads the file from disk and returns its bytes with range support. This module supports allow/deny decisions based on an authorization subrequest. [Nginx authorization subrequest module](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html)

The authorization check resolves the authenticated session, workspace, asset version, published derivative, and requested operation. Do not authorize a directory simply because its path contains a workspace UUID. Validate the canonical path and known derivative filename; reject traversal, symlinks outside approved roots, and unpublished files.

Use the common same-origin session for HLS manifests, segments, and MP4 range requests. This avoids a separate signed-cookie exchange between media domains. Original downloads require the separate `Asset.DownloadOriginal` permission and use a protected download route; ordinary playback grants access to derivatives only.

Cache small permission decisions for at most five seconds, keyed by session, user, resource version, and operation. Do not share authorized decisions based only on a URL. Never publicly cache a protected response without a separate authorization mechanism on every request. Browser caching can use private versioned responses; local disk/OS caching can reduce repeated file reads.

Verify correct `Content-Type`, `Content-Length`, `Accept-Ranges`, `Content-Range`, `ETag`, and `206 Partial Content` behavior. Do not gzip or recompress MP4/HLS media. Disable directory listing and apply safe content disposition for original and arbitrary-file downloads.

Small authorization subrequests still consume some API capacity. Include them in load testing, but the API does not carry the large media response bodies.

## 11. International playback and the supplied connection speed

The reported 939 Mbps uplink is a strong starting point for five optimized streams. It is not evidence of 939 Mbps from this NAS to every user's country. International routing, packet loss, peering, receiver bandwidth, router processing, other NAS traffic, and the NAS Ethernet link all matter.

For one active stream per user:

```text
Required video egress = concurrent streams x average stream bitrate
Planning budget = required video egress x 1.3
```

The multiplier is an initial allowance for overhead and headroom, not a measured protocol constant. Include audio when selecting the actual stream rate.

| Five simultaneous viewers | Video traffic before allowance | Budget using 1.3 multiplier |
| --- | ---: | ---: |
| 1.5 Mbps per stream | 7.5 Mbps | 9.75 Mbps |
| 3 Mbps per stream | 15 Mbps | 19.5 Mbps |
| 6 Mbps per stream | 30 Mbps | 39 Mbps |

Fifteen Mbps is approximately 1.6% of the reported 939 Mbps upload result; 30 Mbps is approximately 3.2%. These are calculations, not observed streaming results. Two simultaneous video layers per user roughly double the video requirement, before prefetches and exports.

The measured downlink also matters for incoming uploads, while the uplink is used by outgoing playback. A speed test performed on another device or against a nearby endpoint does not prove end-to-end NAS throughput. Measure from the actual deployment path and from representative overseas users before accepting the playback target.

NAS-only delivery has no overseas edge copy. A distant seek still traverses the path to this NAS. Encoding reduces bytes and decoding work; buffering, range requests, thumbnails, and proxy caching reduce the visible effect. They cannot eliminate propagation delay, packet loss, client limitations, or an ISP outage. No architecture should promise zero lag in every country under the NAS-only constraint.

Serve a 720p proxy before requesting the original or an unnecessary 4K stream. Keep full-quality downloads and exports from monopolizing egress by giving interactive playback priority or limiting bulk transfer concurrency when measurements show contention.

For storage planning, a constant 3 Mbps stream uses approximately 1.35 GB per hour of video, excluding audio and filesystem overhead. The original and all retained derivatives count separately. Compression does not remove the need to budget original-file growth.

## 12. Durable processing and resource isolation

Start one worker process with one active FFmpeg conversion or export at a time. Use a low worker CPU priority and an initial limit of approximately 0.75 CPU with a 1 GiB memory ceiling. Cap FFmpeg threading to match the quota; test the input decoder and encoder memory use. A CPU quota slows work instead of making it free, and some source formats may exceed the memory limit. Handle that as a visible failed/deferred job with a clear reason.

Priorities are: first playable editing proxy, repair/retry of required derivatives, thumbnails/waveform, normal review packaging, optional higher resolutions, then expensive final exports according to an explicit user priority policy. Avoid starving exports indefinitely; expose queue position and allow an administrator to reserve an export window.

Use PostgreSQL-backed jobs with transactional enqueue, unique operation keys, leases, heartbeats, retries with backoff, and dead-letter status. A crashed worker's lease expires and work can be retried. Do not rely on an in-memory channel or an unobserved background task as the only record of required processing.

Jobs write to a temporary output directory, validate outputs, then atomically publish a completed derivative revision. Repeated attempts must not publish duplicate logical outputs. Reconcile orphaned files after crashes. Keep input versions immutable, and record FFmpeg/build/profile versions for reproducibility.

Protect playback by not starting new conversion jobs during sustained resource pressure. Initial proposed signals are less than 1 GiB available system memory, sustained CPU above 85%, or failing playback/API service targets for a minute. Tune these from observations; do not kill an active job merely because a transient threshold was crossed. New jobs remain queued with an honest status.

Run workers with restricted filesystem mounts, no unnecessary network credentials, bounded process runtime/output, and argument-based FFmpeg invocation. Do not concatenate uploaded filenames into shell commands. Validate files before they become public playback assets.

### Initial memory budget

These are proposed container ceilings for a pilot, not measured working-set requirements. Do not reserve all NAS RAM for containers. Other DSM packages and storage services must be inventoried before applying limits.

| Component | Proposed pilot ceiling |
| --- | ---: |
| Three production frontend processes | 384 MiB each; 1,152 MiB total |
| Shared .NET API, Identity, SignalR | 768 MiB |
| PostgreSQL | 1,024 MiB |
| Resumable upload gateway | 256 MiB |
| Nginx gateway/media server | 128 MiB |
| One worker including FFmpeg | 1,024 MiB |
| Total listed application ceilings | 4,352 MiB, approximately 4.25 GiB |

The remaining nominal RAM must cover DSM, filesystem cache, other packages, and operating headroom. Measure actual memory availability, OOM events, disk latency, and swap. Production images must not run development servers or build steps on the NAS. Keep monitoring lightweight initially; do not add a large observability stack, message broker, Redis, and an identity server without a demonstrated need.

## 13. Collaborative editing and reconnects

Use SignalR for document updates, presence, processing status, and notifications. Start in the shared API host. Presence and cursors are ephemeral; committed editing operations are durable. SignalR transports updates but does not itself provide conflict-free editing.

The proposed initial editing model is server-authoritative operations:

1. An operation carries a unique ID, document ID, actor session, and expected revision or element revision.
2. The server authorizes the operation and validates it against current state.
3. Accepted durable changes are committed with their assigned sequence before the server acknowledges them as saved.
4. The server broadcasts accepted operations to authorized members of that document group.
5. A reconnect supplies its last sequence and receives missing operations or a newer snapshot.
6. Repeated operation IDs are deduplicated. A conflicting structural timeline change is rejected with resynchronization/reapply information rather than silently overwriting another edit.

Commit a realtime outbox event in the same database transaction as each durable operation. A lightweight relay hosted in the API claims and publishes those events independently of the media conversion queue; a long FFmpeg job must not delay broadcasts. The relay marks an event sent only after its publish attempt succeeds, retries failures, and preserves document sequence order. Delivery is at least once, so clients deduplicate by operation ID and sequence. A successful publish attempt does not prove that every browser received it.

Connected, foreground editors therefore reconcile their document head revision through the API every ten seconds as well as on reconnect and return from a background tab. A higher head revision or sequence gap triggers replay of missing committed operations, or a snapshot if the retained log is insufficient. This repairs the case where the last broadcast is missed while the client remains connected. Editing conflict resolution must use committed server state even before that periodic check. Durable saves are acknowledged after database commit; online delivery status is a separate concern.

Use per-element concurrency where operations are independent, and explicit revision checks for structural timeline edits. This proposal does not include offline multi-writer merging or a fully automatic rich-text CRDT. If those become required, choose a collaboration algorithm and compatible persistence model in a dedicated design before building that feature; a SignalR hub alone is insufficient.

Throttle cursor/presence messages to a bounded rate, initially at most five updates per second per connected editor. Do not write every cursor movement into PostgreSQL. Bound message size and document group membership. Snapshot large documents periodically and retain a bounded operation history according to the recovery policy.

## 14. Can one backend handle all applications?

One backend application is a code and deployment boundary, not a single-request queue. ASP.NET Core can process concurrent requests. Actual capacity is determined by request work, database queries, locks, connection pools, CPU, RAM, file I/O, and network behavior.

For this initial workload, one properly implemented API instance is a reasonable starting hypothesis. It has not been benchmarked on this NAS, and the five SceneFlow users do not define the total peak KHP/Moodboard user count. Validate with all products active.

An illustrative pilot workload is:

- Five SceneFlow editor sessions, with five concurrent proxy streams.
- Ordinary metadata traffic at five requests per second, plus bursts to 25 requests per second across applications.
- Committed editing operations at up to two per second per active editor as a starting test workload.
- Presence messages at up to five per second per editor, with fan-out measured separately.
- Additional Nginx media authorization subrequests.
- One concurrent resumable upload and one constrained conversion job.

These are test inputs, not usage measurements or throughput guarantees. Cursor fan-out, playback requests, and expensive report queries have different costs and must not be collapsed into one vague count of API hits.

Protect the shared service using asynchronous I/O, bounded concurrency, efficient queries, explicit pagination, cancellation, job queues, and per-user/workspace policies for expensive operations. Apply rate limits by endpoint class and test their interaction with normal editor bursts. Built-in rate limiting is a control mechanism, not evidence of capacity. [ASP.NET Core rate limiting](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-10.0)

### Scaling sequence

1. Measure request latency, slow queries, disk waits, conversion load, and international playback.
2. Fix expensive queries, N+1 reads, excessive polling, and oversized snapshots.
3. Reduce or reschedule conversion work if it harms interactive workloads.
4. Increase resources or move compute only after a separate hardware decision; do not assume more containers on the same 8 GB NAS create more resources.
5. If API processing is the measured bottleneck and hardware permits it, run multiple instances of the same API code behind a load balancer.
6. Before multiple API instances, share Data Protection keys and server sessions, coordinate authorization invalidation and job leases, and add an appropriate SignalR backplane/session-affinity configuration. Review global rate limits across instances.
7. Extract a product or collaboration service only when independent scaling or isolation is needed. Media storage and delivery remain on the NAS unless the user changes that requirement.

SignalR has specific multi-server connection routing and scale-out requirements; a second API process is not a complete realtime scale-out design. [SignalR hosting and scaling](https://learn.microsoft.com/en-us/aspnet/core/signalr/scale?view=aspnetcore-10.0)

## 15. Operations, recovery, and failure behavior

The NAS is a single failure domain. A power, storage, router, ISP, or host failure can affect all three products and their media. Several API containers on the same host do not provide host-level high availability.

Use health checks for API readiness, PostgreSQL connectivity, worker heartbeat, disk space, and upload/media routes. Collect structured logs and request IDs; log resource IDs and timings without recording session cookies, passwords, or upload capability secrets. Record API latency, database query time, active streams, media bytes, queue depth/age, conversion duration, dropped/rejected edits, disk latency, CPU, RAM, and swap.

Keep versioned database backups and a tested restore procedure. Continuous WAL archiving plus periodic base backups is the proposed production direction; pilot logical dumps can prove basic restore mechanics but do not provide the same recovery granularity. Filesystem snapshots alone do not establish a valid live database backup. [PostgreSQL backup and restore](https://www.postgresql.org/docs/current/backup.html)

Original media, database records, application configuration, and protected key material require backup. Regenerable derivatives have a different retention priority. The `backups/` directory on the same NAS is convenient staging, not protection against complete NAS loss.

To preserve the no-cloud requirement, a separate owner-controlled backup device or removable copy is the recommended disaster-recovery option. Its location, schedule, and retention need approval before production data is considered protected. No off-NAS video copy is assumed authorized by this document. If all copies must stay on this single NAS, record the accepted inability to recover from complete device loss.

Proposed targets for review are metadata recovery point within 15 minutes and service recovery within four hours after a recoverable failure. These are objectives requiring backup implementation, replacement capacity, and restore drills, not current capabilities. Original media recovery depends on the chosen backup process and retention capacity.

Deletion is a workflow: mark the version unavailable, prevent new access, account for live project references, then remove eligible files after the retention policy. A retry or reconciliation job must not resurrect intentionally deleted media. Default original retention is indefinite until an authorized deletion policy is agreed.

## 16. Verification and acceptance plan

No deployment, performance test, video conversion, or NAS inspection was performed for this architecture document. The following checks must be completed during implementation and pilot rollout.

### Functional and security acceptance

| ID | Acceptance condition |
| --- | --- |
| A1 | Sign into KHP once, navigate to Moodboard and SceneFlow, and access their APIs without another login. |
| A2 | Sign out or revoke the session; new API/media requests are denied within the specified revocation window. |
| A3 | An authenticated user cannot access another workspace's tasks, documents, files, or SignalR groups by guessing IDs. |
| A4 | Moodboard and SceneFlow task creation preserve source links, respect KHP permissions, and deduplicate retries. |
| A5 | Interrupt an upload, restart the browser/gateway, and resume from the correct offset without corrupting the original. |
| A6 | A failed/crashed worker leaves no public partial derivative; retry publishes one valid logical result. |
| A7 | Originals remain unchanged; exports use the original versions and proxy time mapping is correct for test footage. |
| A8 | MP4 ranges and HLS manifests/segments are authorized, seekable, and served by the file server rather than the API body pipeline. |
| A9 | Two users editing the same document see accepted changes, duplicate operations are ignored, and conflicting edits are handled explicitly. |
| A10 | Recreating containers preserves accounts, sessions as intended, assets, job state, and encryption keys. |
| A11 | Restore metadata and source-media references from backup into a clean environment and verify checksums and project playback. |
| A12 | Quotas, disk-pressure behavior, access revocation, unsupported files, and upload capability expiry behave as specified. |
| A13 | Revoke a session or workspace membership while SignalR remains connected; hub commands and outbound document updates stop within five seconds, including when the immediate revocation notification is deliberately dropped. |
| A14 | Commit an edit, fail its first broadcast, and leave the recipient connected with no later edits; outbox retry or ten-second head reconciliation recovers the exact committed operation without duplicate application. |

### Performance pilot

Use real source samples covering the team's typical codecs, 1080p/4K inputs, source frame rates, variable frame rate, high motion, text, and any HDR material. Report conversion time, CPU/RAM, output size, measured peak bitrate, visual quality, source-time alignment, and browser compatibility. Do not claim support for a format just because FFmpeg recognizes its container.

Run at least a 30-minute workload with five SceneFlow clients, KHP and Moodboard metadata traffic, an upload, and one constrained conversion. Include actual users in representative countries and compare with a local baseline. Test a two-layer timeline separately from one-stream playback.

Initial proposed service objectives under the defined pilot conditions are:

- Ordinary metadata API p95 latency under 250 ms measured near the NAS; record overseas end-to-end latency separately.
- No lost acknowledged editing operations and no unauthorized cross-workspace events.
- Proxy playback startup p95 under three seconds and rebuffering below 1% of playback time on the tested international paths at the selected quality.
- Warm proxy seeks p95 under one second in supported desktop browsers on the tested paths; report cold seeks separately.
- No sustained swapping, OOM restarts, or uncontrolled job growth during the pilot.
- Interactive workloads continue to meet the targets with one conversion job, or conversion is automatically deferred until they do.

These are proposed acceptance targets, not measured outcomes. If a user's international route cannot sustain the selected stream rate, demonstrate fallback to a lower quality and show a clear connection/processing status. NAS-only delivery cannot guarantee these targets on every public network.

## 17. Delivery stages

This is an architecture design and dependency roadmap, not an approved code-level implementation plan. Detailed implementation tasks and exact test interfaces follow design review.

| Stage | Deliverable | Exit evidence |
| --- | --- | --- |
| 1. Inventory and deployment proof | Confirm NAS model, DSM, free RAM, storage layout, inbound HTTPS, actual NAS network path, and build pipeline. | Small health endpoint and protected file route accessible through the intended domain; resource baseline recorded. |
| 2. Shared identity and workspace access | Identity, cookie sessions, invitations, roles, antiforgery, Data Protection persistence. | A1-A3 and session/key persistence checks pass across three test frontend routes. |
| 3. KHP server persistence | KHP module, generated client, authorized browser-data import, task APIs, source-link contracts. | Existing UI uses server records; migrations preserve IDs/references; retries and task permissions pass. |
| 4. Assets and media foundation | Resumable upload, immutable original storage, metadata, jobs, protected range delivery. | A5, A6, A8, A12 and restart/reconciliation checks pass. |
| 5. SceneFlow playback | Editor proxy, review packaging, thumbnails, waveform, accurate source-time mapping. | Representative video profile and five-user international pilot meet agreed targets. |
| 6. Product collaboration | Versioned board/timeline operations, SignalR, durable realtime relay, revision reconciliation, cross-app tasks. | A4, A7, A9, A13, A14 pass including overlapping edits, disconnects, lost broadcasts, and active-connection revocation. |
| 7. Production readiness | Resource limits, alerts, backup/restore, recovery runbook, release rollback. | A10-A11, restore drill, mixed-product load report, and agreed operational ownership. |

For existing browser-local data, inventory each user's browser data before import, map browser member records to verified accounts explicitly, and provide a dry-run report. Do not merge records solely by display name or replace other users' data silently. Preserve task and asset references, source timestamps, and audit provenance. Do not import browser-stored passwords as server credentials.

## 18. Remaining implementation decisions

The plan can be reviewed now. These items affect concrete deployment or domain feature work and are not assumed known:

- Exact NAS model suffix, DSM version, disk/RAID layout, usable/free storage, existing container workloads, and measured available RAM.
- Controlled public domain, inbound reachability/CGNAT status, certificate process, and representative user countries.
- Expected total KHP/Moodboard peak users, typical upload size/duration, codecs, source frame rates, and whether layered playback is common.
- Whether the proposed upload limits, role matrix, session policy, conflict handling, and indefinite original retention match product needs.
- Backup location/authorization and achievable recovery objectives under the NAS-only media policy.
- Whether frame-accurate effects and simultaneous rich-text editing require a later specialized collaboration or rendering design.

A competent implementer can choose ordinary library versions and internal class names within the stated constraints. They must not silently add cloud media delivery, claim a tested capacity, relax resource authorization, or replace original media with lossy proxies.
