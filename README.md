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

Specimens are stored locally under the dedicated `mrslop_specimens_v1` storage key. The key name remains stable, while stored specimens now use **schema version 4**. Valid schema-v1, schema-v2, and schema-v3 Mr. Slop specimens migrate locally to schema v4. Existing messages, artifacts, genomes, checkpoints, mutation state, scars, birth baselines, life history, and one-parent fork ancestry are preserved. Migration does not invent missing ancestors or second parents.

The application does not read, migrate, or delete old Ghost session storage.

A Mr. Slop reply can be saved as an artifact. Saved artifacts carry provenance back to the specimen, source message, active genome, and installed component IDs that produced them.

## Round 2B lineage, forks, scars, and drift

Round 2B gives specimens real application-owned lineage without turning Mr. Slop into a family-tree dashboard.

### In-app specimen forks

A **fork** is a new saved Mr. Slop specimen inside this application. It is **not** a GitHub repository fork.

A fork is a structural action and waits for explicit approval. The parent remains a separate saved specimen. The child starts a fresh conversation and receives child-local copies of the parent's current active state:

- current genome, including an already-persisted FUSE kernel;
- active acquired traits, with new child IDs and inheritance references;
- active temporary infections with their remaining duration, again as child-local records; and
- existing scars as inherited historical records, plus a fork-birth ancestry scar.

The child does **not** copy the parent's chat transcript, artifacts, checkpoints, retired traits, inactive infections, or full life history.

Fork persistence is collection-level and atomic from the UI's point of view: parent-with-fork-history and child are written together before the new child is exposed as saved state. Forking itself does not trigger another Gemini call and does not recompile FUSE.

### Scars

Scars are durable historical facts about meaningful specimen events such as surviving a temporary infection, promoting an infection, fossilizing an accident, restoring a checkpoint, changing a genome, or being born from a fork.

Scars are **not runtime prompt layers**. They do not change behavior by themselves. If a historical behavior should become active behavior, it must be represented explicitly as a trait or another approved mutation.

### Lifetime drift

Drift is a deterministic application calculation from stored specimen state. It does not use embeddings, hidden model states, latent-space claims, or an extra model request.

A forked child captures its own birth baseline after child-local inherited IDs are created, so its lifetime drift begins at exactly zero even when it inherits traits, infections, and scars.

The score is explainable from these dimensions:

- enabled genome-component symmetric difference: +4 each;
- genome assembly-mode change: +3;
- custom-seed change: +2;
- active post-baseline acquired trait: +3 each;
- retired lifetime trait: +2 each;
- distinct post-baseline infection: +1 each, capped at 4;
- experienced post-baseline scar: +1 each, capped at 4; and
- checkpoint restore: +1 each, capped at 3.

Bands are **LOW 0–2**, **MODERATE 3–7**, **HIGH 8–14**, and **EXTREME 15+**. Generation is displayed alongside drift but is not itself a drift penalty.

Specimens migrated from Round 2A use a conservative baseline. Mr. Slop does not invent chronology that the older schema did not record.


## Round 2C breeding and controlled freak genetics

Round 2C adds deterministic **two-parent breeding** between existing spawned specimens. Breeding uses each parent's **current lived state** while keeping the calculation application-owned and inspectable.

The human chooses both parents. Mr. Slop may show factual contrasts such as generation, enabled component count, active traits, and overlap, but it does not rank mates or assign compatibility scores.

### Genome crossover

Ordinary crossover uses only enabled components in the parents' current genomes. The child genome targets the unbiased average of the two enabled component counts and preserves the existing component kinds as breeding roles.

- a component unique to one parent has crossover weight **1.0**;
- a functionally identical component shared by both parents has weight **2.0**;
- same-ID but functionally divergent snapshots are treated as mutually exclusive alleles;
- parental unique contribution is repaired toward balance when the role structure permits it; and
- final STACK order is deterministic from the parents' ordering information.

The child is always born **STACK**. Parent FUSE kernels and parent custom-seed text do not cross the breeding boundary, and breeding never triggers FUSE compilation.

### Trait inheritance

Only active acquired traits enter trait genetics. Temporary infection records never cross breeding.

Initial inheritance probabilities are:

- ordinary active or already-inherited trait: **35%**;
- promoted-infection trait: **45%**;
- fossilized-accident trait: **55%**;
- functionally identical trait present in both parents: **70%**; and
- direct factual scar support: **+15 percentage points once**.

At most three active traits survive inheritance. If more than three pass their rolls, the application keeps the three strongest normalized passes and records the displaced candidates in the genetics receipt.

A child inherits the behavior but not the parent's lifecycle claim. A fossilized or promoted parent trait becomes a child-local active trait with origin `inherited` and factual source ancestry. Parent scars are not copied into bred children.

### Birth mutation

After ordinary inheritance, a deterministic **1-in-8** birth-mutation roll occurs. At most one birth mutation can happen.

The preferred branch is chosen 50/50:

- add one pinned canonical library component absent from both parents' complete current genomes and from the child; or
- apply one registered deterministic application-owned variation to an inherited trait.

If the preferred branch has no valid target, the engine tries the other branch. If neither is valid, the receipt records a triggered no-op rather than inventing a mystery gene.

### GENETICS RECEIPT and replay

Every offspring preview contains an application-owned **GENETICS RECEIPT** recording the breeding seed, algorithm version, parent-state hashes, component candidates and weights, trait probabilities and rolls, scar support, cap displacement, mutation decision, and final birth state.

Breeding uses namespaced deterministic random decisions instead of a fragile sequential random stream. The determinism contract is:

> same breeding-relevant parent states + same seed + same genetics algorithm version = same genetic result.

Receipts can be replay-verified against the parent states that created them.

### Preview, stale-state protection, and persistence

Breeding is preview-first. **THIS CREATES OFFSPRING** shows the exact proposed child before any write occurs.

Approval rechecks both parents' breeding-state hashes. If breeding-relevant state changed, the preview is rejected as stale rather than silently creating a different child. Conversation messages, artifacts, and previous offspring-history events do not invalidate a preview because they are outside the breeding calculation.

Successful approval writes both parent offspring-history records plus the child in one collection save. The approved preview has an idempotency key, so a duplicate submit cannot accidentally create identical twins. Intentionally breeding the same pair again uses a new seed and may create a different sibling.

A bred child starts with:

- true two-parent schema-v4 lineage;
- generation `max(parent generations) + 1`;
- fresh conversation/history;
- no copied parent infections, scars, artifacts, or checkpoints;
- its own STACK birth/current genome;
- inherited child-local traits;
- its persisted genetics receipt; and
- **lifetime drift 0** from its complete birth state.

Breeding itself makes **zero Gemini calls**.

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
4. **Lineage/history state** — schema-v4 root/fork/bred lineage, birth baseline, typed scars, offspring history, and append-only life-history evidence.
5. **Deterministic genetics layer** — breeding-state hashes, seeded crossover, trait inheritance, birth mutation, and replayable genetics receipts without model calls.
6. **Deterministic drift layer** — explainable lifetime distance from this specimen's own birth baseline, computed without model calls.
7. **Software state** — messages, checkpoints, artifacts, persistence, and controller/trajectory placeholders.
8. **Server transport** — Gemini generation and one-time FUSE compilation without exposing the API key to the client.

## Round 2C non-goals

Round 2C deliberately does **not** implement automatic mate ranking, compatibility scoring, chromosome simulation, dominant/recessive genes, population ecology, Petri-dish tournaments, automatic selective breeding, a full family-tree visualization, artifact/infection/scar copying across bred births, model-generated mystery genes, Semantic Manifold/SRE/TOPOS integration, external controllers, or cloud sync. The genetics system remains explicit application state rather than a claim about model weights, hidden states, or latent DNA.
