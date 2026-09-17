# Mr. Slop

Mr. Slop is a conversation-first structured-instability lab for building and talking with modular AI specimens.

The interface is deliberately not a dashboard with a chatbot bolted onto it. You start with **BUILD ME**, choose a way into the experiment, and then work mostly by talking to Mr. Slop. The software owns the specimen state underneath the conversation: genome, installed mechanisms, checkpoints, artifacts, and provenance.

## Build routes

- **SURPRISE ME** — assemble a complementary starting genome automatically.
- **I HAVE AN IDEA** — talk through a vague or specific idea and let Mr. Slop propose a build.
- **LET ME PICK THE PARTS** — search the pinned component library and explicitly choose mechanisms.
- **START FROM A SPECIMEN** — reopen a saved creature and keep working with it.

## Genomes

Mr. Slop currently supports two assembly modes:

- **STACK** keeps selected component prompts distinct and active together.
- **FUSE** makes one server-side compiler call when the genome changes and stores the resulting compiled kernel on the specimen. Ordinary conversation does not recompile it every turn.

The current library contains the pinned Round 1 AI SLOP component set. Components keep source/version metadata so an existing specimen does not silently change when the source library changes later.

## Conversation and structural changes

Ordinary chat is one model call per turn. Mr. Slop can offer lightweight choice cards in conversation. Choices that would change what the specimen *is* use the blocking structural-decision path and wait for user approval before the genome changes.

A checkpoint is recorded before approved structural mutations. Failed model turns keep the user message visible without mutating the genome.

## Saved specimens and artifacts

Specimens are stored locally under the dedicated `mrslop_specimens_v1` key. The application does not read, migrate, or delete old Ghost session storage.

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

## Round 1 architecture

The important separation is:

1. **Mr. Slop shell** — stable conversational identity and application-control contract.
2. **Specimen genome** — mutable selected mechanisms, STACK/FUSE state, and optional custom seed.
3. **Software state** — messages, checkpoints, artifacts, future scars/trajectory/controller fields.
4. **Server transport** — Gemini generation and one-time FUSE compilation without exposing the API key to the client.

This gives later mutation, lineage, semantic-manifold, and external-controller experiments somewhere real to attach without pretending those systems are hidden model internals.
