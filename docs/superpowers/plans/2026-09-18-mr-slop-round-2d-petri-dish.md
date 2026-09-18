# Mr. Slop Round 2D Implementation Plan: Petri Dish and Phenotype Trials

Date: 2026-09-18

## Status

Approved design:
`docs/superpowers/specs/2026-09-18-mr-slop-round-2d-petri-dish-design.md`

Implementation proceeds sequentially, test-first, with one focused branch/PR per job. Each job must pass the complete repository test suite, typecheck/lint, production build, and GitHub Actions before merge. The next job starts only after the previous job is merged.

The known Gemini/API-key mismatch is intentionally isolated from pure state/UI work. Live-provider acceptance may remain pending while mocked acceptance is required to pass.

## Global invariants

Every job must preserve these Round 2D invariants:

- 2–8 distinct spawned specimens per trial.
- one shared text challenge.
- one visible generation call per entrant attempt.
- no hidden judge, critique, ranking, or model-scoring call.
- entrant runtime is frozen from current lived state.
- ordinary chat transcript never enters the trial.
- live specimens are observationally immutable during trial execution.
- temporary infection behavior may enter the frozen runtime snapshot but live remaining-turn counts never decrement.
- FUSE entrants reuse the persisted compiled kernel and never recompile for Petri.
- Petri persistence uses a dedicated `mrslop_petri_trials_v1` store.
- never read, migrate, rewrite, or delete `ghost_sessions`.
- raw output is phenotype evidence, not objective fitness.
- human selection supports none/one/many and creates no automatic specimen mutation.
- OPEN/FORK/BREED post-trial actions hand off to existing engines rather than duplicating their logic.
- live Gemini transport is separated from pure runner/state code and mocked in tests.

---

## Job 1 — Petri schema, types, and dedicated persistence

### Goal

Create the application-owned Petri trial data model and local persistence boundary without touching specimen storage.

### Test-first scope

Add tests covering:

- empty Petri store loads as an empty collection;
- valid schema-v1 trials round-trip through persistence;
- malformed records are rejected or safely ignored according to the existing store style;
- selection and result status values survive reload;
- dedicated key is exactly `mrslop_petri_trials_v1`;
- specimen storage key remains exactly `mrslop_specimens_v1`;
- `ghost_sessions` is never referenced;
- saving Petri trials does not call specimen persistence.

### Implementation

Likely files:

- `types.ts`
- `services/petriStore.ts`
- `tests/petriStore.test.ts`

Add explicit types for:

- `PetriTrialStatus`
- `PetriEntrantResultStatus`
- `PetriGenerationConfig`
- `PetriEntrantSnapshot`
- `PetriEntrantAttempt`
- `PetriSelection`
- `PetriTrial`

Keep trial schema version at 1.

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 2 — Frozen entrant snapshots and deterministic Petri hashes

### Goal

Create pure snapshot and hashing functions that capture runtime-relevant lived state without chat-history contamination.

### Test-first scope

Cover:

- only spawned specimens accepted;
- building specimen rejected;
- active traits included;
- retired traits excluded from runtime snapshot;
- active infections included with remaining duration;
- inactive/expired/removed/promoted infections excluded as active runtime;
- messages, artifacts, checkpoints, unrelated life history excluded;
- current STACK order and custom seed influence hash;
- FUSE compiled kernel influences hash;
- non-runtime scar/history/display metadata does not influence hash;
- same semantic runtime state hashes identically;
- changing an active runtime prompt changes the hash;
- input specimen remains immutable.

### Implementation

Likely files:

- `lib/petriSnapshot.ts`
- reuse stable serialization/hash primitives where appropriate without coupling to breeding-state semantics.

Expose:

- `createPetriEntrantSnapshot(specimen, options?)`
- `petriEntrantStateHash(snapshot)`
- `createPetriChallengeHash(challenge)`

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 3 — Dedicated plain-generation transport client

### Goal

Provide a Petri generation client that does not append/parse the ordinary Mr. Slop response-envelope contract.

### Test-first scope

Cover:

- empty conversation history is sent;
- exact shared challenge becomes the only user turn;
- exact supplied system instruction is posted;
- generation settings are forwarded;
- raw text and finish reason return without envelope parsing;
- transport/provider errors surface with code/message;
- abort signal is respected;
- no mutation/fork/breeding response contract is added;
- no specimen state is mutated.

### Implementation

Likely files:

- `services/petriGenerationService.ts`
- minimal shared transport extraction from `services/geminiService.ts` if useful;
- no provider-specific key work in this job.

The client may post to existing `/api/mr-slop/chat` while treating it as a plain text generation endpoint.

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 4 — Petri trial runner, bounded concurrency, abort, and retry

### Goal

Build the pure/application runner that executes one call per entrant attempt with maximum three concurrent requests.

### Test-first scope

Cover:

- 2–8 distinct entrant requirement;
- one call per entrant;
- maximum three in flight;
- user-selected entrant order preserved in stored result order;
- one entrant failure does not erase successful results;
- failed entrant is recorded as failed, not selected/lost;
- explicit retry creates a new attempt number for only that entrant;
- retry does not rerun successful entrants;
- abort marks unfinished attempts aborted and preserves completed outputs;
- no hidden app-layer retry;
- runner never mutates supplied specimen collection/snapshots;
- partial and complete status transitions are deterministic.

### Implementation

Likely files:

- `lib/petriRunner.ts`
- `tests/petriRunner.test.ts`

Dependency-inject the generation function so tests do not need a live provider.

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 5 — Human selection and blind-label model

### Goal

Add pure selection/reveal mechanics without automatic scores.

### Test-first scope

Cover:

- zero selected entrants allowed;
- one selected entrant allowed;
- multiple selected entrants allowed;
- duplicate selected IDs normalized/rejected safely;
- selection can be revised explicitly;
- blind labels remain stable per entrant within one trial;
- blind selection records that identity was hidden at selection time;
- reveal changes display state only;
- no numerical fitness score is created;
- selection never mutates specimens or trial outputs.

### Implementation

Likely files:

- `lib/petriSelection.ts`
- `tests/petriSelection.test.ts`

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 6 — Petri setup and preflight UI

### Goal

Create the setup surface for choosing entrants and entering the shared challenge.

### Test-first scope

Cover:

- only spawned specimens appear;
- selection enforces 2–8 distinct entrants;
- shared challenge required;
- factual entrant summaries only;
- exact expected call count displayed before run;
- FUSE entrant missing compiled kernel is blocked;
- cancel before run performs no Petri/specimen write;
- no model call occurs before RUN PETRI DISH.

### Implementation

Likely components:

- `components/PetriDishSetup.tsx`
- `components/PetriEntrantPicker.tsx`
- route/surface integration from `App.tsx` or current shell.

Use dedicated full-screen experimental surface rather than overloading ordinary chat.

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 7 — Running/results UI, failures, retries, and blind view

### Goal

Render live trial progress and phenotype outputs.

### Test-first scope

Cover:

- pending/running/succeeded/failed/aborted states;
- side-by-side result cards;
- output text dominates card;
- blind labels A/B/C… hide names;
- reveal restores names without rerun;
- failed entrant exposes explicit retry;
- retry updates only that entrant's attempts/result;
- abort preserves completed results;
- no specimen writes occur during observation;
- selection controls support none/one/many.

### Implementation

Likely components:

- `components/PetriDishRunner.tsx`
- `components/PetriResultCard.tsx`
- `components/PetriSelectionBar.tsx`

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 8 — Petri history browser and reload

### Goal

Persist and reopen completed/partial trials without regeneration.

### Test-first scope

Cover:

- completed trial reopens after reload;
- partial trial reopens with failures intact;
- historical open causes zero generation calls;
- challenge excerpt/entrant count/status/selection count display correctly;
- exact saved outputs remain unchanged;
- selection may be explicitly revised;
- revising selection does not regenerate outputs or mutate specimens.

### Implementation

Likely components:

- `components/PetriHistory.tsx`
- app navigation integration.

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 9 — Existing OPEN/FORK/BREED handoff

### Goal

Connect selected Petri entrants to existing specimen actions without duplicating mutation/breeding engines.

### Test-first scope

Cover:

- one selected entrant exposes OPEN and FORK;
- exactly two selected entrants additionally expose BREED SELECTED;
- more than two selected entrants do not expose automatic multi-parent breeding;
- OPEN resolves current live specimen by specimen ID;
- FORK uses existing fork approval/persistence path;
- BREED SELECTED opens existing Round 2C breeding preview using current live states;
- a specimen changed after the Petri trial is allowed; breeding preview reflects current state;
- stale Petri snapshot is never used as genetic material;
- Petri record remains unchanged by post-trial actions.

### Implementation

Prefer callbacks/adapters into existing app actions over copied business logic.

### Merge gate

Full tests, lint/typecheck, build, CI green.

---

## Job 10 — Full Round 2D acceptance, docs, and regression hardening

### Goal

Prove the whole mocked Round 2D flow while preserving Round 1/2A/2B/2C behavior.

### Acceptance scenario

Create at least four spawned specimens including:

- STACK specimen with active trait;
- specimen with active turn-limited infection;
- valid FUSE specimen;
- bred/forked descendant with lineage/drift state.

Then:

1. open Petri setup;
2. select all four;
3. enter one challenge;
4. verify call count = 4;
5. freeze entrant snapshots;
6. run with mocked generation;
7. produce three successes and one failure;
8. verify all original specimens byte-for-byte behaviorally unchanged;
9. retry only the failed entrant;
10. enter blind view;
11. select two outputs;
12. persist trial;
13. reload app/trial;
14. reveal identities;
15. launch BREED SELECTED;
16. verify breeding uses current live parent states and existing genetics preview;
17. cancel breeding;
18. verify Petri record remains intact and no specimen changed.

### Documentation

Update README with:

- Round 2D Petri Dish behavior;
- dedicated Petri store key;
- phenotype terminology and honesty boundary;
- call-count semantics;
- non-destructive trial semantics;
- blind human selection;
- post-trial handoff;
- known live Gemini/API-key blocker if still unresolved.

### Regression requirements

- full test suite green;
- TypeScript/lint green;
- production build green;
- Round 2C breeding acceptance still green;
- ordinary chat behavior unchanged;
- no new hidden model calls;
- specimen store key unchanged;
- `ghost_sessions` untouched.

### Final completion gate

Round 2D is implementation-complete when all ten jobs are merged and CI is green. If live Gemini remains unavailable solely because of the already-known API-key/runtime mismatch, record live-provider verification as pending rather than weakening mocked acceptance.
