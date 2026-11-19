# SceneFlow Web

The SceneFlow frontend in the KHP platform repository. This directory currently contains a Next.js scaffold. The product interface and backend integrations are awaiting PRD review.

## Stack

- Next.js 16.4.6 with App Router and React 19.
- TypeScript in `src/`, with the `@/*` import alias.
- Tailwind CSS and Biome.
- npm with a dependency lockfile.

## Local development

Run these commands from this directory:

```powershell
npm ci
npm run dev
```

Open [http://localhost:3002](http://localhost:3002). Port 3002 separates SceneFlow from the KHP and Moodboard development defaults.

## Validation

```powershell
npm run lint
npm run typecheck
npm run build
```

For a local production preview, run `npm run build` followed by `npm start`.

## Product references

- [SceneFlow PRD draft](../../docs/superpowers/specs/2026-11-19-sceneflow-prd.md)
- [Shared platform architecture proposal](../../docs/superpowers/specs/2026-11-17-shared-dotnet-platform-architecture.md)
- [Figma reference: Scene Flow, node 28:3](https://www.figma.com/design/Q9zWEwG11gRksGM0w9kfRa/KHP?node-id=28-3)

The platform proposal calls for a shared .NET backend, shared KHP login, and NAS-hosted media. This scaffold does not implement those services or configure a production deployment.
