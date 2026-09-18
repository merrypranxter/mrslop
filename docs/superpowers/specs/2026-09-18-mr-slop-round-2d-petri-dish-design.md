# Mr. Slop Round 2D Design: Petri Dish and Phenotype Trials

Date: 2026-09-18

## Status

Conversational architecture approved enough to formalize. Written design pending final user approval before implementation planning.

## 1. Purpose

Round 2D adds a **Petri Dish**: a controlled, multi-specimen experiment surface where several existing spawned specimens receive the same challenge under frozen copies of their current lived state.

The point is not to invent a mystical fitness score. The point is to observe what different specimen configurations actually produce when exposed to the same pressure.

Round 2D therefore creates a clean experimental bridge:

> genotype / current lived state -> frozen trial state -> observed output -> human selection -> optional later fork or breeding action

The Petri Dish is comparative experimental infrastructure, not autonomous evolution.

## 2. Product boundary

Round 2D includes:

- selecting 2–8 existing spawned specimens,
- entering one shared text challenge,
- freezing a trial-local runtime snapshot of each entrant,
- running exactly one isolated generation call per entrant,
- preserving identical model/settings/challenge across entrants,
- storing the exact output or failure for each entrant,
- recording trial provenance in a dedicated Petri store,
- showing outputs side-by-side,
- optional blind display of entrant identity before selection,
- human selection of zero, one, or multiple winners,
- storing selection as experimental history,
- opening an entrant after the trial,
- forking a selected specimen through the existing fork engine,
- breeding two selected specimens through the existing breeding engine,
- preserving the real specimens unchanged by the trial itself,
- and explicit call-count/cost visibility before the run.

Round 2D does **not** include:

- automatic phenotype scoring,
- automatic mate recommendation,
- automatic culling,
- automatic mutation,
- automatic selective breeding,
- repeated autonomous generations,
- population ecology,
- hidden judge calls,
- multi-agent critique loops,
- tournament brackets,
- dominant/recessive simulation,
- chromosome simulation,
- latent-space or embedding fitness,
- Semantic Manifold/SRE/TOPOS integration,
- cloud synchronization,
- or any claim that the outputs reveal model internals.

## 3. Core Petri invariants

1. Every entrant receives the same user challenge.
2. Every entrant receives the same generation parameters.
3. Each entrant gets exactly one model call per run attempt.
4. No extra judge or critique calls occur implicitly.
5. Entrants run from frozen trial-local snapshots.
6. The specimen's existing conversation transcript is not supplied to the trial.
7. The specimen's real state is not mutated by the trial.
8. Trial calls do not decrement live temporary infections.
9. Trial calls do not create traits, scars, checkpoints, artifacts, or ordinary specimen messages.
10. Trial calls do not change drift.
11. The raw generated output is stored as phenotype evidence.
12. Failed entrants are recorded as failures; they are not silently retried into different experimental conditions.
13. Human selection is explicit and may choose none, one, or several entrants.
14. Selection itself does not mutate, fork, breed, or delete a specimen.
15. Fork/breed actions after selection use the existing approved engines.
16. Petri records live separately from specimen persistence.
17. The experiment records enough information to explain exactly which specimen state produced which output.
18. The system never describes trial results as objective biological fitness.
19. A Petri trial may compare relatives, unrelated specimens, roots, forks, or bred descendants without special ranking rules.
20. The API-key/runtime issue is a known transport blocker for live calls but does not block implementation of Round 2D state, UI, persistence, and mocked tests.

## 4. Entrant eligibility

An entrant must:

- be a persisted specimen,
- be in phase `spawned`,
- have a valid current genome,
- have a valid schema-v4 specimen record.

A single trial requires between **2 and 8 distinct specimen IDs**.

Building specimens are not eligible.

No kinship restriction applies.

A specimen may participate in multiple trials.

## 5. Shared challenge

Round 2D v1 uses one shared **text challenge**.

The challenge is stored exactly as submitted after normal whitespace-preserving string handling.

The same challenge text is sent to every entrant.

Attachments are intentionally deferred from v1 because browser-local file handles and large inline payloads complicate exact cross-entrant replay and persistence. A later Petri algorithm version may add shared attachments with explicit content hashing.

## 6. Trial-local frozen runtime snapshot

Starting a Petri trial freezes each entrant's application-owned runtime-relevant state.

The snapshot includes:

- specimen ID,
- specimen display name at trial time,
- schema version,
- lineage summary,
- current genome snapshot,
- active acquired traits,
- active temporary infections including remaining duration,
- birth baseline reference data needed for factual display,
- current drift report at snapshot time,
- current generation,
- and a deterministic state hash.

The snapshot excludes:

- ordinary conversation messages,
- artifacts,
- checkpoints,
- inactive infections,
- retired traits as runtime layers,
- unrelated life-history entries,
- UI state,
- later specimen changes.

The frozen snapshot is a trial record. It is not a new specimen.

## 7. Trial-state hash

Each entrant snapshot receives a deterministic **Petri entrant-state hash**.

The hash includes all state that can alter the entrant's trial runtime behavior:

- current genome mode,
- enabled component order and functional snapshots,
- current custom seed if STACK,
- persisted compiled FUSE kernel if FUSE,
- active trait prompts and relevant structured modifiers,
- active infection prompts and duration state,
- app prompt/runtime version identifiers required to assemble the instruction.

The hash excludes:

- messages,
- artifacts,
- display-only timestamps,
- prior offspring history,
- non-runtime scars,
- unrelated life-history data.

The hash exists for audit/provenance, not to promise deterministic model output.

## 8. Runtime isolation

A Petri run must not reuse ordinary chat history.

For every entrant:

- history is empty,
- user content contains only the shared challenge,
- the system instruction is assembled from the frozen entrant snapshot,
- the same Petri experiment instruction is appended,
- no ordinary mutation/fork UI envelope is requested,
- the output is treated as plain phenotype text.

This prevents a specimen's previous conversation from becoming an uncontrolled experimental variable.

## 9. Petri experiment instruction

Each trial call receives a short application-owned instruction layer establishing experimental behavior:

- respond directly to the shared challenge,
- operate through the installed frozen specimen machinery,
- do not discuss being in a competition unless the challenge itself asks,
- do not emit mutation/fork/breeding application commands,
- do not claim the trial changed the specimen,
- do not rank other entrants because they are not visible,
- return only the response that this specimen would produce for the challenge.

The entrant never sees competitor outputs.

## 10. Model and generation settings

All entrants in one trial must use the same:

- model identifier,
- temperature,
- max output tokens,
- server route / generation backend,
- Petri experiment instruction version.

The initial v1 defaults should match ordinary Mr. Slop generation unless there is a strong technical reason to use a dedicated setting.

These settings are persisted on the Petri record.

Changing settings creates a different experimental run rather than silently modifying an existing one.

## 11. Call-count transparency

Before running, the UI must state the exact expected generation-call count.

Example:

`4 specimens = 4 generation calls`

Round 2D makes no hidden additional calls.

If an entrant fails due to transport/API/model error, that failure is stored.

Automatic retry behavior already inside the server transport for transient provider failures may remain, but the application must not convert a failed entrant into an invisible fresh experimental attempt with changed parameters.

Manual retry of one failed entrant is allowed only as an explicit action and is recorded as a new attempt for that entrant.

## 12. Concurrency

The Petri runner may execute entrant calls concurrently with a small bounded concurrency limit.

Initial target:

- maximum **3 in-flight entrant calls** at once.

This protects the provider/runtime from a sudden 8-request burst while keeping the experiment reasonably fast.

Call ordering must not affect stored entrant identity or result ordering.

UI ordering remains the user-selected entrant order.

## 13. Failure semantics

Entrant result status is one of:

- `pending`,
- `running`,
- `succeeded`,
- `failed`,
- `aborted`.

A failure record stores:

- factual error code if available,
- user-facing error text,
- attempt number,
- timestamps,
- no fabricated output.

Other entrants may finish normally.

A partially completed trial remains inspectable.

The user may:

- keep the partial trial,
- retry individual failed entrants,
- or abandon the trial.

A failed entrant is never automatically treated as losing.

## 14. Phenotype result

A successful entrant produces one **phenotype observation**.

The observation stores:

- entrant snapshot ID,
- specimen ID,
- raw output text,
- finish reason if available,
- model/settings,
- start/end timestamps,
- attempt number,
- system-instruction hash,
- shared challenge hash,
- and the entrant-state hash.

Phenotype means observed output under defined conditions.

It does not mean hidden-state measurement, neural phenotype, or objective fitness.

## 15. Exact system-instruction provenance

Historical reproducibility requires knowing what instruction was actually used.

Round 2D should persist:

- the exact assembled system instruction used for the call,
- a deterministic hash of that instruction,
- the Petri instruction version.

This is intentionally redundant with the frozen snapshot.

The snapshot explains the application state; the exact instruction proves what was sent.

If storage size later becomes a concern, compression/versioned reconstruction can be introduced in a later schema.

## 16. Trial identity

Each Petri trial receives:

- a random local trial ID,
- a created timestamp,
- challenge text,
- challenge hash,
- selected entrant IDs,
- entrant snapshot records,
- generation configuration,
- result records,
- selection record,
- trial status,
- schema version.

Trial identity is not based on deterministic hashing because repeated runs of the same challenge against the same specimens are legitimate independent observations.

## 17. Dedicated persistence

Petri trials use a separate local storage key.

Initial key:

`mrslop_petri_trials_v1`

Do not overload `mrslop_specimens_v1`.

Do not touch `ghost_sessions`.

A Petri save writes the whole Petri collection using the same local-first persistence philosophy as specimen storage.

Trial persistence should survive reload.

## 18. Trial schema v1

Conceptual structure:

```ts
interface PetriTrial {
  schemaVersion: 1;
  id: string;
  challenge: string;
  challengeHash: string;
  status: 'draft' | 'running' | 'partial' | 'complete' | 'abandoned';
  model: string;
  temperature: number;
  maxOutputTokens: number;
  experimentInstructionVersion: string;
  entrantOrder: string[];
  entrants: PetriEntrantSnapshot[];
  results: PetriEntrantResult[];
  selection: PetriSelection | null;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastModified: number;
}
```

Exact field names may change during implementation planning, but the semantics above are required.

## 19. Entrant snapshot identity

Every entrant gets a trial-local snapshot ID distinct from the specimen ID.

This allows future trials or retries to refer to the exact frozen entrant state even if the live specimen later changes.

The snapshot stores the original specimen ID as provenance.

## 20. Non-destructive trial behavior

Running a trial must not alter any live specimen field.

Specifically no changes to:

- `messages`,
- `currentGenome`,
- `birthGenome`,
- `acquiredTraits`,
- `infections`,
- `scars`,
- `checkpoints`,
- `lifeHistory`,
- `birthBaseline`,
- `lineage`,
- `geneticsReceipt`,
- `lastModified`.

The trial is observational.

## 21. Temporary infections inside a trial

An active temporary infection is part of current runtime behavior and therefore **does** enter the frozen trial snapshot.

However, the trial call does not consume one of the live specimen's remaining turns.

The frozen snapshot records the remaining-turn count as contextual state.

The model receives the active infection behavior, but no decrement is written back.

This gives an honest answer to:

> What would this specimen produce right now?

without aging the specimen.

## 22. FUSE entrants

A FUSE entrant uses the persisted compiled kernel already stored on the frozen snapshot.

The Petri trial does not recompile FUSE.

If a FUSE specimen is missing its compiled kernel, that entrant is invalid for the trial and should be blocked or recorded as a preflight failure.

No hidden compiler call is allowed.

## 23. Display order and blind mode

The result UI defaults to the selected entrant order.

Round 2D also supports **BLIND VIEW**:

- hide specimen names,
- show neutral labels such as A, B, C, D,
- preserve stable label-to-entrant mapping within the trial,
- reveal identities only when the user requests reveal or finalizes selection.

Blind mode changes display only.

It does not alter model calls or persistence.

## 24. Human selection

After results exist, the user may select:

- no winner,
- exactly one winner,
- multiple winners,
- or mark the trial undecided.

The application stores the selection as an explicit user judgment.

The selection record includes:

- selected entrant snapshot IDs,
- optional note,
- selected/revised timestamp,
- whether selection was made while identities were blind or revealed.

No numerical fitness score is required.

## 25. Selection language

The app may use ordinary experiment language such as:

- selected,
- preferred,
- winner,
- survived this trial,
- useful result.

It must not claim:

- objectively superior,
- genetically fitter in general,
- best specimen overall,
- optimal mate,
- scientifically validated intelligence.

Selection is challenge-specific human preference.

## 26. Post-trial actions

After a user selection, the UI may offer explicit actions.

For one selected entrant:

- **OPEN SPECIMEN**
- **FORK SELECTED**

For exactly two selected entrants:

- **OPEN**
- **FORK**
- **BREED SELECTED**

For more than two selected entrants:

- **OPEN**
- **FORK**
- no automatic multi-parent breeding.

`BREED SELECTED` opens the existing Round 2C breeding preview using the **current live specimens**, not the stale Petri snapshots.

If either live specimen changed after the trial, that is acceptable and visible because breeding already snapshots current lived state at preview time.

The Petri result is selection evidence, not genetic material itself.

## 27. No automatic life-history mutation in v1

A Petri trial record is authoritative inside the Petri store.

Round 2D v1 does **not** automatically append trial participation/winner events into every specimen's life history.

Reason:

- doing so would make an observational experiment mutate its subjects,
- it would alter `lastModified`,
- it would complicate strict non-destructive semantics.

A later round may add explicit “record this trial on specimen history” actions.

## 28. Trial comparison facts

The UI may show factual entrant context beside outputs:

- generation,
- lineage kind,
- drift band/score at snapshot time,
- current genome mode at snapshot time,
- enabled component count,
- active trait count,
- active infection count.

These are descriptive.

Round 2D must not turn them into automatic rankings.

## 29. Repeated trials

Running the same challenge again against the same frozen-equivalent specimen states creates a new trial.

The app does not promise identical model output because generation is stochastic.

Repeated trials are useful observations.

The application can later compare repeated trials, but statistical aggregation is deferred from v1.

## 30. Abort behavior

The user may abort a running Petri trial.

Aborting:

- signals outstanding client requests where supported,
- marks unfinished entrant attempts as aborted,
- preserves already completed results,
- persists the partial trial,
- does not alter specimens.

## 31. Draft/preflight behavior

Before the first model call, the app performs preflight validation:

- 2–8 eligible distinct entrants,
- non-empty challenge,
- valid frozen snapshots,
- FUSE kernels present where needed,
- exact expected call count known.

Only after user presses **RUN PETRI DISH** are calls started.

Cancelling during draft/preflight writes no trial unless the implementation plan intentionally supports saved drafts.

For v1, unsaved draft cancellation is preferred.

## 32. UI flow

Primary flow:

1. **PETRI DISH**
2. select 2–8 specimens
3. enter shared challenge
4. review factual entrant summary
5. review expected call count
6. **RUN PETRI DISH**
7. progress view
8. side-by-side results
9. optional **BLIND VIEW / REVEAL**
10. select zero/one/multiple outputs
11. save selection
12. optional OPEN / FORK / BREED SELECTED

The Petri surface may be a dedicated full-screen route rather than a chat overlay.

This is one of the few places where a dashboard-like surface is justified because the task is explicitly multi-specimen comparison.

## 33. Result card

Each entrant result card shows:

- neutral label or specimen name,
- status,
- output text,
- factual snapshot facts,
- retry button if failed,
- selection checkbox/button.

The output is the dominant visual element.

Genome metadata should not overwhelm the actual phenotype.

## 34. Petri history

A compact trial-history browser should allow reopening past trials.

Each row shows:

- date,
- challenge excerpt,
- entrant count,
- completion status,
- number selected.

Opening a historical trial is read-only except for:

- revising the human selection,
- opening current live specimens,
- explicit post-trial actions against current live specimens.

Historical outputs are never regenerated automatically on open.

## 35. Model-response boundary

Round 2D should use a dedicated plain-generation client function rather than ordinary `sendMrSlopMessage`.

Reason:

ordinary chat appends the structured Mr. Slop response envelope contract for mutation/fork/build UI actions. A Petri phenotype call should not ask the model to produce application-control JSON.

The dedicated Petri call may still post to the same server endpoint if the server route already supports generic `contents + systemInstruction`.

The client contract should return:

- raw text,
- finish reason,
- provider error metadata.

No mutation/fork envelope parsing occurs.

## 36. API-key blocker boundary

The currently reported Gemini/API-key mismatch is a known external integration issue.

Round 2D implementation must therefore separate:

- pure trial-state construction,
- snapshot hashing,
- persistence,
- UI,
- selection,
- result handling,

from:

- live generation transport.

Tests must mock the generation client.

A broken live API key must not prevent all Round 2D code from being implemented or tested.

Final live-provider acceptance may remain pending until the key/runtime mismatch is repaired.

## 37. Test strategy

Implementation is test-first.

Required test groups:

1. **Petri snapshot**
   - only spawned specimens eligible
   - 2–8 distinct entrants
   - current lived state captured
   - messages/artifacts excluded
   - active infection captured without live mutation
   - FUSE kernel preserved without recompilation
   - deterministic entrant-state hash

2. **Petri runtime**
   - no ordinary history
   - identical challenge/settings
   - one generation call per entrant
   - no structured mutation/fork envelope
   - bounded concurrency
   - input order preserved in results
   - no specimen mutation

3. **Failure behavior**
   - partial success persisted
   - failure is not a loss
   - explicit retry creates attempt 2
   - abort preserves completed results
   - no hidden retries at app layer

4. **Persistence**
   - dedicated `mrslop_petri_trials_v1`
   - reload round-trip
   - historical trial immutable except explicit selection revision
   - never touches `ghost_sessions`
   - never rewrites specimen collection during observation

5. **Selection**
   - zero/one/multiple selection
   - blind/revealed flag
   - challenge-specific wording
   - no automatic ranking score
   - no specimen mutation

6. **UI**
   - preflight call count
   - 2–8 picker
   - progress surface
   - side-by-side result cards
   - blind mode
   - retry failed entrant
   - post-trial OPEN/FORK/BREED actions

7. **End-to-end mocked acceptance**
   - choose 4 specimens
   - freeze snapshots
   - run four mocked generation calls
   - one failure, three successes
   - retry failure explicitly
   - blind-select two
   - persist/reload
   - reveal identities
   - launch existing breeding flow for selected pair
   - verify all original specimens remained unchanged until explicit breeding action

## 38. Suggested implementation decomposition

A later implementation plan should likely split Round 2D into jobs roughly as follows:

1. Petri schema/types + dedicated storage
2. frozen entrant snapshots + deterministic hashes
3. dedicated plain-generation transport client
4. bounded-concurrency trial runner + failure/abort/retry semantics
5. selection and blind-label model
6. Petri setup/preflight UI
7. running/results UI
8. historical trial browser
9. existing fork/breed post-trial integration
10. final acceptance/docs/regression

Exact job boundaries should be finalized only after this written design is approved.

## 39. Explicitly deferred beyond Round 2D

- automatic phenotype scoring,
- automatic judge model,
- rubric-based AI judging,
- repeated multi-round tournaments,
- brackets,
- population-level selection,
- automatic selective breeding,
- automatic culling,
- autonomous ecology,
- dominant/recessive genetics,
- chromosome/meiosis simulation,
- statistical repeated-trial analysis,
- artifact/media challenges,
- cross-trial phenotype analytics,
- automatic promotion of emergent mechanisms,
- full family-tree visualization,
- dormant-gene trigger engine,
- Semantic Manifold/SRE/TOPOS controller integration,
- cloud synchronization.

## 40. Completion criteria

Round 2D is complete when:

- 2–8 spawned specimens can enter one shared text challenge,
- each entrant runs from an isolated frozen lived-state snapshot,
- every entrant receives exactly one visible generation call per attempt,
- no hidden judge/critique calls exist,
- live specimens remain unchanged by observation,
- active infection effects can appear without decrementing live infection duration,
- FUSE entrants use persisted kernels without recompilation,
- trial results and failures persist independently from specimens,
- side-by-side and blind comparison work,
- human selection supports zero/one/multiple winners,
- selection does not mutate specimens,
- OPEN/FORK/BREED SELECTED hand off to existing approved engines,
- Petri history survives reload,
- mocked end-to-end acceptance passes,
- tests, typecheck, and production build are green,
- and the only remaining blocker, if any, is the already-known live Gemini/API-key transport issue.
