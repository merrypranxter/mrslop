# Mr. Slop

Mr. Slop is a conversation-first structured-instability lab for building and talking with modular AI specimens.

The interface is deliberately not a dashboard with a chatbot bolted onto it. You start with **BUILD ME**, choose a way into the experiment, and then work mostly by talking to Mr. Slop. The software owns the specimen state underneath the conversation: genome, mutations, checkpoints, artifacts, life history, and provenance.

The pinned mechanism library is derived from the companion AI SLOP source repository, `merrypranxter/ai_slop`. Mr. Slop stores prompt snapshots and source metadata so an existing specimen does not silently change when that source evolves later.

## Build routes

- **SURPRISE ME** — assemble a complementary starting genome automatically.
- **I HAVE AN IDEA** — talk through a vague or specific idea and let Mr. Slop propose a build.
- **LET ME PICK THE PARTS** — search the pinned component library and explicitly choose mechanisms.
- **START FROM A SPECIMEN** — reopen a saved creature and keep working with it.

## Genomes

Mr. Slop supports two assembly modes:

- **STACK** keeps selected component prompts distinct and active together.
- **FUSE** makes one server-side compiler call when the genome changes and stores the resulting compiled kernel on the specimen.

FUSE is not rerun for ordinary conversation or for runtime mutation layers. A normal chat turn remains one model request by default.

The birth genome is historical identity. Runtime behavior is assembled from the current genome plus any active acquired traits and active temporary infections.

## Round 2A mutation lifecycle

Mutations are real specimen state, not decorative chat lore.

### Temporary infections

A temporary infection adds an operational prompt layer without changing the birth genome. It can be:

- **turn-limited**, such as 3, 5, or 8 successful turns; or
- **indefinite**, remaining active until explicitly removed or promoted.

A turn is consumed only after a usable model reply has been accepted into the conversation. Failed, aborted, or transport-error turns do **not** decrement an infection. When a limited infection reaches zero it becomes `expired` and remains in the specimen record rather than disappearing.

### Acquired traits and fossilized accidents

An acquired trait is a lasting behavior learned during this specimen's lifetime. A temporary infection can also be promoted into an acquired trait.

A **fossilized accident** preserves a useful behavior that emerged in conversation without pretending the application extracted a secret neural mechanism. It records an operational description and factual provenance from real specimen messages/artifacts when those references are available.

Persistent changes use the blocking **THIS CHANGES THE SPECIMEN** approval flow. A checkpoint is created immediately before the approved change is applied.

### Undo and checkpoints

Mr. Slop can request reversible actions conversationally, including removing an infection, retiring a trait, or restoring a checkpoint. If more than one real target matches an undo request, the app presents the actual candidates instead of guessing.

Checkpoint restore rewinds the current genome, acquired traits, and infections. It does **not** erase the conversation, saved artifacts, or life-history evidence that the later experiment happened.

Useful phrases include:

- `fuck with yourself`
- `try that temporarily`
- `keep that shit`
- `undo that shit`

These are conversational conveniences, not magic keywords; Mr. Slop can discuss the same operations in ordinary language.

## Runtime layer order

For a spawned specimen, the system instruction is assembled in this order:

1. stable Mr. Slop shell;
2. specimen kernel protocol;
3. current STACK or persisted FUSE kernel;
4. active acquired traits;
5. active temporary infections;
6. compact current specimen state.

Mutation layers wrap around a persisted FUSE kernel. They do not trigger hidden compiler calls or silently rebuild the kernel.

## Provenance and technical honesty

Mutation provenance stores the specimen ID, active genome ID, source type, and source message/artifact IDs. Returned source IDs are checked against actual specimen state before they are persisted; invented references are discarded.

Mr. Slop does not claim prompts literally rewrite model weights, hidden states, or neural architecture. Terms such as genome, infection, fossilization, and mutation describe application-managed prompt/state mechanisms.

## Conversation and structural changes

Ordinary chat is one model call per turn. Mr. Slop can offer lightweight choice cards in conversation. Choices that would change what the specimen *is* use the blocking structural-decision path and wait for user approval before the persistent state changes.

Failed model turns keep the user message visible and leave genome/mutation state intact.

## Saved specimens and artifacts

Specimens are stored locally under the dedicated `mrslop_specimens_v1` storage key. The key name remains stable so existing Round 1 specimens can be found, but stored specimens now use **schema version 2**. Valid schema-v1 Mr. Slop specimens migrate locally to schema v2 with their messages, artifacts, genomes, and checkpoints preserved.

The application does not read, migrate, or delete old Ghost session storage.

A Mr. Slop reply can be saved as an artifact. Saved artifacts carry provenance back to the specimen, source message, active genome, and installed component IDs that produced them.

## Gemini / Google AI Studio

Gemini calls are server-side. The browser posts to Mr. Slop's same-origin API routes:

- `POST /api/mr-slop/chat`
- `POST /api/mr-slop/fuse`

Set `GEMINI_API_KEY` in the server/runtime environment. In Google AI Studio, keep it in **Secrets**; it is not injected into the browser bundle.

The current model identifier is defined in `services/geminiService.ts`.

## Local development

```bash
npm install
npm run dev
```

The development server runs the Express/Vite host so the same `/api/mr-slop/*` routes used in AI Studio are available locally.

Verification commands:

```bash
npm test
npm run lint
npm run build
```

Production build output includes the Vite client plus the bundled Node server at `dist/server.cjs`. Start it with:

```bash
npm start
```

## Current architecture

The important separation is:

1. **Mr. Slop shell** — stable conversational identity and application-control contract.
2. **Specimen genome** — current selected mechanisms, STACK/FUSE state, and optional custom seed.
3. **Mutation layer** — acquired traits plus active temporary infections, applied at runtime.
4. **Software state** — messages, checkpoints, artifacts, life history, and future scars/trajectory/controller fields.
5. **Server transport** — Gemini generation and one-time FUSE compilation without exposing the API key to the client.

## Round 2A non-goals

Round 2A deliberately does **not** implement breeding, lineage visualization, Petri-dish tournaments, drift scoring, dormant trigger ecology, Semantic Manifold/SRE integration, or external controllers. The mutation/life-history layer exists so those later systems can inherit real specimen history instead of fake lore.
