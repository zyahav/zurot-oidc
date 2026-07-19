# Tzura Creator Vertical Slice v1

## Architecture Summary

This slice adds the first production-shaped ZurOt voice-to-Tzura creator path.
The realtime loop is intentionally outside Codex:

```text
typed child instruction
-> command interpreter
-> GameSpec update
-> live portrait runtime update
```

Typed instructions simulate the future voice/realtime agent. Codex is only the
implementation/build-time engineer, not part of the child-facing fast loop.

Publishing creates a frozen artifact snapshot. Later draft edits and remixes do
not mutate the published artifact.

## Routes Touched

- `/tzura/create`: active-profile creator route. Requires a real signed-in
  active profile outside the QA bridge.
- `/portal/app/tzura-creator`: portal app-detail entry that launches the
  creator.
- `/portal`: automatically includes the Tzura Creator through the app catalog.

## Convex Tables

- `tzuraDrafts`: editable profile-owned GameSpec draft.
- `tzuraArtifacts`: immutable published GameSpec snapshot.
- `tzuraFeedItems`: profile feed pointer to a published artifact.

## Convex Functions

- `tzuras.getLatestDraft`
- `tzuras.saveDraft`
- `tzuras.publishDraft`
- `tzuras.remixArtifact`
- `tzuras.listFeedItems`

Important invariant: `tzuraArtifacts.gameSpecSnapshot` must not be updated after
publish. Changes create a new draft/remix and then a new artifact.

## QA Bridge

`/tzura/create?qaProfile=playwright` enables local automated QA without Clerk
test credentials. It keeps the creator behavior testable while the production
route remains gated.

The QA bridge is not a product entry point. It exists to prove:

- live GameSpec updates
- frozen publish behavior
- editing a draft after publish does not change the frozen artifact
- remix creates a new editable draft copy

## Accepted Limitations

- Full signed-in Clerk plus active child profile E2E was not run in this phase.
- Browserbase MCP is the desired ZurOt browser automation default, but it is not
  configured in the active Codex host session used for this work.
- Existing npm audit findings were not changed.
- Existing Convex generated/config lint warnings were not changed.
- The visual runtime is a simple HTML/CSS game preview, not a full game engine.

## Commands Run

```bash
npm install
npx convex codegen
npm run lint
npm run build
npx playwright install chromium
npm run start -- -p 3000
npx playwright test scripts/qa/tzura-create.spec.ts --project=chromium
```

Final verification:

- `npm run lint`: passed with 5 pre-existing warnings.
- `npm run build`: passed.
- `npx playwright test scripts/qa/tzura-create.spec.ts --project=chromium`:
  passed, 2 tests.

## How To Run

```bash
npm install
npx convex codegen
npm run build
npm run start -- -p 3000
```

Open:

- Real product route after sign-in and active profile:
  `http://localhost:3000/portal/app/tzura-creator`
- Local QA bridge:
  `http://localhost:3000/tzura/create?qaProfile=playwright`

## Follow-Up Tasks

1. Run a real signed-in Clerk smoke with a Zuriel-approved active child profile.
2. Configure Browserbase MCP/env at the Codex host level.
3. Run portal-to-creator proof in Browserbase.
4. Replace the typed-command bridge with the realtime voice agent adapter.
5. Add a feed player route for published Tzura artifacts.
