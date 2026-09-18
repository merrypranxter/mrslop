# Mr. Slop Round 2B Design: Forking, Scars, and Drift

Date: 2026-09-18

## Status

Approved conversational design, pending final written-spec review before implementation planning.

## 1. Purpose

Round 2B adds three related specimen-history capabilities to Mr. Slop:

1. **Forking** — create a new specimen from another specimen's current state without modifying the parent.
2. **Scars** — retain durable, factual marks of significant experiences without automatically turning them into behavior.
3. **Drift** — summarize how far a specimen has changed from its own birth baseline using explainable application-owned state rather than pretending to measure latent-space distance.

The goal is to make later breeding and lineage work operate on creatures with real histories rather than on prompt piles.

Round 2B remains conversation-first. It should extend the existing specimen model without turning Mr. Slop into a genealogy dashboard.

## 2. Repository and product boundary

"Fork" in Round 2B means **a specimen fork inside the running Mr. Slop application**.

It does not mean:

- a GitHub fork,
- a second repository,
- a second deployment,
- or a permanently separate code branch.

The whole application remains in the single `merrypranxter/mrslop` repository and continues to run from the normal merged `main` branch.

Multiple forked specimens are saved inside the same application storage and may be opened independently.

## 3. Architectural direction

Round 2B uses a **lean lineage layer**.

The application will add:

- structured lineage metadata,
- structured scar records,
- immutable per-specimen birth baselines,
- deterministic drift calculation,
- compact lineage/drift UI,
- explicit fork creation.

It will not add:

- a full family-tree visualization,
- breeding or inheritance recombination,
- dominant/recessive genetics,
- phenotype scoring,
- Petri-dish tournaments,
- automatic ecological competition,
- latent-space or embedding-based drift,
- Semantic Manifold/SRE/TOPOS integration,
- or external controllers.

Those systems may consume Round 2B state later.

## 4. Fork semantics

### 4.1 Parent behavior

Creating a fork must never mutate the parent specimen.

The parent keeps:

- its specimen ID,
- birth genome,
- current genome,
- messages,
- artifacts,
- checkpoints,
- acquired traits,
- infections,
- scars,
- lineage,
- life history,
- and drift baseline.

No checkpoint is required merely to create a child because the parent is not structurally changed.

A parent life-history event may record that a child was forked from it.

### 4.2 Child identity

A fork creates a new specimen with:

- a new specimen ID,
- a new name,
- a new created-at timestamp,
- a new lineage record,
- a new birth baseline,
- fresh child-local IDs for inherited mutable records,
- a fresh conversation,
- and its own future checkpoints, artifacts, mutations, scars, and life history.

The child becomes an independent specimen immediately after creation.

### 4.3 Fresh conversation

A child fork does **not** copy the parent's full chat transcript.

Instead, the child starts with a compact system-generated birth note that records factual ancestry and inherited state, such as:

> Forked from SLOP 12 at generation 2. Inherited current genome, 2 active acquired traits, 1 active infection, and 3 scars.

The exact wording may vary, but it must remain factual and derive from saved specimen state.

This prevents every descendant from duplicating a full transcript and keeps divergent lives clean.

## 5. Fork inheritance boundary

Round 2B follows this rule:

> **What is active now gets inherited. What merely happened before becomes ancestry/history.**

### 5.1 Inherited into the child

The child receives:

- the parent's **current genome**,
- all **currently active acquired traits**,
- all **currently active infections** with their current remaining durations,
- the parent's existing scars as inherited scars,
- lineage references to parent and root ancestor.

The parent's current state becomes the child's new birth state.

### 5.2 Not copied into the child

The child does not copy:

- the parent's full messages,
- the parent's artifacts,
- the parent's checkpoints,
- retired traits,
- expired infections,
- removed infections,
- promoted infection records,
- or the parent's full life-history event stream.

Those records belong to the parent's lived timeline.

Relevant past experience crosses the boundary only through structured lineage metadata and inherited scars.

### 5.3 Child-local IDs

Inherited active traits, infections, and scars receive **new child-local IDs**.

Each inherited record keeps a reference to the source record it came from, including at minimum:

- source specimen ID,
- source record ID,
- inheritance timestamp.

This prevents mutable IDs from being shared across specimens while preserving ancestry.

## 6. Birth baseline

Every specimen has an immutable birth baseline used for lifetime drift.

### 6.1 Root specimen

For a naturally created specimen, the birth baseline is the specimen's original creation state.

### 6.2 Forked specimen

For a forked specimen, the birth baseline resets to the exact state inherited from the parent at the fork moment.

This means:

- the child starts with zero lifetime drift,
- inherited active traits are part of the child's birth state,
- inherited active infections are part of the child's birth state,
- inherited scars are ancestry, not evidence of child-acquired lifetime drift.

The lineage record still preserves parent and root ancestry so future features can calculate ancestral drift separately.

## 7. Lineage model

Each specimen should receive a structured lineage record.

Minimum fields:

- `rootSpecimenId`
- `parentSpecimenId` or null
- `generation`
- `forkedAt` when applicable
- `forkSourceEventId` or equivalent stable reference when applicable
- `forkSourceCheckpointId` when the fork was explicitly tied to a checkpoint
- `forkSourceGenomeId`
- `inheritedFromSpecimenId` where useful for child-local records

Generation rules:

- root specimens are generation 0,
- direct children are parent generation + 1,
- descendants continue incrementing from their immediate parent.

Lineage metadata is factual application state, not model-authored lore.

## 8. Life-history additions

Round 2B extends the append-only life-history event stream.

New event types should include at minimum:

- `specimen-forked`
- `specimen-born-from-fork`
- `scar-acquired`
- `scar-inherited`
- `drift-band-changed` only if the implementation proves this event is useful and non-noisy

Parent and child events should reference each other where stable IDs permit.

A fork should produce:

- a parent event indicating that a child was created, and
- a child birth-from-fork event identifying its parent.

Life-history events remain append-only and are not erased by checkpoint restore.

## 9. Scars

### 9.1 Definition

A scar is a durable historical mark that says something significant happened to the specimen.

A scar is **not** automatically a prompt instruction.

Scars are data for:

- lineage,
- drift explanation,
- future breeding/selection,
- future comparison,
- and specimen history.

If a scar should change behavior, it must later be explicitly promoted into an acquired trait through the normal structural approval flow.

### 9.2 Scar shape

Each scar should record at minimum:

- `id`
- `name`
- `description`
- `kind`
- `origin`: experienced | inherited
- `createdAt`
- `sourceSpecimenId`
- `sourceScarId` when inherited
- related life-history event IDs
- related mutation/trait/infection/checkpoint IDs where applicable
- related message/artifact IDs where factual provenance exists

Scars should remain technically factual. They must not claim discovery of hidden model internals.

### 9.3 Automatic scar creation

Not every life-history event becomes a scar.

Round 2B should automatically create scars for a narrow set of meaningful structural experiences, including:

- a turn-limited infection reaching natural expiry,
- an active infection being promoted into a lasting trait,
- a fossilized accident being approved,
- a checkpoint restore that removes or reverses a previously lasting state,
- a real current-genome mutation,
- birth from a fork.

Other events may become scars later through explicit user/Mr. Slop proposal, but Round 2B should avoid over-scarification.

### 9.4 Inherited scars

When a child is forked:

- the parent's existing scars are copied as child-local inherited scars,
- inherited scars point back to their source scar and source specimen,
- inherited scars do not count as child-acquired lifetime scars,
- inherited scars remain available for future ancestry/breeding logic.

### 9.5 Scar persistence

Checkpoint restore must not erase scars.

A scar records that an experience occurred. Reverting structural state does not make the historical experience untrue.

## 10. Drift

### 10.1 Technical meaning

Drift is a deterministic summary of application-owned state differences.

It is **not**:

- a latent-space measurement,
- an embedding distance,
- a hidden-state probe,
- a measure of model-weight change,
- or a scientific psychological score.

No extra model call is required to calculate drift.

### 10.2 Lifetime drift

Lifetime drift compares the specimen's current/lifetime state to its own immutable birth baseline.

For a forked child, its inherited fork state is the baseline.

### 10.3 Future ancestral drift

Round 2B data should make future ancestral drift possible:

> descendant current state versus root ancestor birth state.

Full ancestral-drift UI does not need to ship in Round 2B, but the lineage/baseline data must not block it.

## 11. Drift dimensions

Round 2B drift should be derived from factual dimensions such as:

### Genome drift

- enabled components added/removed/replaced,
- STACK/FUSE mode change,
- custom seed change,
- current genome ID differing because of explicit genome mutation.

Genome drift should carry the greatest weight because it changes the specimen's installed genetic structure.

### Trait drift

- active traits acquired after birth,
- traits retired after birth,
- infection-to-trait promotions,
- fossilized traits created during the specimen's own life.

Inherited birth traits do not count as lifetime drift until their status changes after birth.

### Mutation history

- infections started after birth,
- infections naturally expired,
- infections removed,
- infections promoted.

Temporary mutation history contributes less than persistent trait/genome change.

### Scar accumulation

- experienced scars acquired after birth count toward lifetime drift,
- inherited scars do not count toward lifetime drift.

### Reversion activity

- checkpoint restores after birth contribute modestly because they indicate structural wandering even when the specimen later returns toward its baseline.

### Lineage depth

- generation is shown as ancestry context,
- generation alone should not inflate lifetime drift because a child begins at zero lifetime drift.

## 12. Drift score and bands

The application may compute a deterministic internal drift index for:

- sorting,
- comparison,
- future breeding,
- and stable band assignment.

The weighting must be explicit in code and covered by tests.

The UI should not present the index as a scientific measurement.

User-facing bands:

- **LOW**
- **MODERATE**
- **HIGH**
- **EXTREME**

The displayed drift explanation must include the factual reasons behind the band.

Example:

> **DRIFT: HIGH**  
> Genome changed twice · 3 lifetime traits · 1 retired trait · 4 experienced scars  
> Most divergence came from persistent behavior changes.  
> Generation 3 from root specimen SLOP 04.

The wording may be generated deterministically by the application. No model call is required.

## 13. Drift explainability rules

Every drift band must be explainable from stored state.

The drift engine should expose structured dimensions in addition to the band, for example:

- genome delta count,
- acquired lifetime trait count,
- retired lifetime trait count,
- lifetime infection event count,
- experienced scar count,
- checkpoint restore count,
- generation.

Tests should assert both:

- the deterministic band/index result, and
- the dimensions that caused it.

This prevents "drift" from becoming arbitrary vibes.

## 14. UI

Round 2B remains conversation-first.

### 14.1 Lineage/drift strip

A small compact strip near the existing mutation-status area may show:

`GEN 2 · 3 SCARS · DRIFT: MODERATE`

It should not dominate the chat.

Tapping/opening it should show a compact panel with:

- parent specimen,
- root ancestor,
- generation,
- lifetime drift band and explanation,
- active inherited state summary,
- experienced scars,
- inherited scars.

### 14.2 Fork action

Forking must be an explicit action.

A conversational request such as:

- "fork this thing",
- "make a copy and let it evolve separately",
- "split this specimen",

may produce a fork proposal/action.

The application should show a blocking structural-style confirmation explaining:

- a new specimen will be created,
- the parent will remain unchanged,
- the child starts a fresh conversation,
- active state will be inherited,
- historical clutter will not be copied.

### 14.3 After fork creation

After a successful fork, present a lightweight choice:

- **OPEN CHILD**
- **STAY WITH PARENT**

No automatic switch is required.

The child should already be persisted before either option is chosen.

## 15. Fork naming

The app should assign a sensible default child name without requiring a dialog.

A simple default is acceptable, for example:

- `<parent name> / FORK 1`
- `<parent name> / FORK 2`

The implementation may provide a rename path later.

Fork naming must not affect lineage identity; IDs are authoritative.

## 16. Prompt behavior

Scars do not automatically enter the runtime prompt.

Lineage and drift summaries may be included in the compact specimen-state summary when useful, but should remain concise.

Active behavior continues to be:

1. stable Mr. Slop shell,
2. current specimen genome/kernel,
3. active acquired traits,
4. active infections,
5. compact specimen state,
6. response-envelope contract.

Round 2B must not make every inherited scar into a prompt layer.

## 17. Forked active infections

Active infections are inherited with their remaining duration.

Example:

Parent has `Metric Vertigo` with 2 successful turns remaining.

Child inherits a new child-local infection record with:

- 2 turns remaining,
- the same operational prompt,
- inherited provenance pointing to the parent infection,
- a new child-local infection ID.

Parent continues with its own separate 2-turn infection record.

Future successful turns decrement each specimen independently.

## 18. Forked active traits

Only active traits cross the fork boundary.

The child receives new child-local trait records whose initial state is part of the child's birth baseline.

Retired traits do not cross the boundary.

Inherited active traits do not count as child lifetime drift unless the child later changes their state.

## 19. Checkpoints

Parent checkpoints never cross the fork boundary.

A child begins with zero checkpoints.

Its inherited state is the child's birth baseline, not a checkpoint imported from the parent.

The child creates its own checkpoints only after its own structural changes.

## 20. Artifacts and messages

Parent messages and artifacts stay with the parent.

The child should not duplicate them.

If a scar or inherited record references evidence from the parent, lineage/inheritance provenance may retain the relevant source IDs and source specimen ID, but the child does not pretend those artifacts/messages are child-owned records.

Any UI attempting to open cross-specimen evidence must first verify that the source specimen still exists.

Round 2B does not need a full cross-specimen evidence browser.

## 21. Persistence and schema migration

Round 2B changes specimen structure and therefore requires a new schema version.

Recommended target:

- `schemaVersion: 3`

The LocalForage storage key remains:

- `mrslop_specimens_v1`

Existing schema-v2 specimens must migrate in place without data loss.

Migration should:

- preserve specimen IDs,
- preserve messages/artifacts/checkpoints/genomes,
- preserve mutation state and life history,
- convert existing placeholder `scars` into an empty typed scar list when necessary,
- create root lineage metadata for existing specimens,
- establish a birth baseline from their known birth genome plus the minimal known original state available,
- avoid inventing historical traits/infections that cannot be reconstructed.

Migration must not read or modify `ghost_sessions`.

## 22. Existing specimens and imperfect historical baselines

Existing schema-v2 specimens may already have acquired traits/infections that were added after their original birth, while Round 2A did not persist a complete birth snapshot of those collections.

Migration must not fabricate certainty.

For migrated pre-Round-2B specimens:

- birth genome comes from the existing immutable `birthGenome`,
- birth traits/infections default to the minimal reconstructable state,
- lineage marks them as migrated roots,
- drift explanations should avoid claiming exact pre-2B lifetime chronology where the old schema cannot prove it.

The implementation may mark the baseline with a quality/source field such as:

- `native-v3`
- `migrated-v2`

This allows technically honest drift summaries.

## 23. Error and transaction behavior

Fork creation must be transactional from the user's point of view.

If child creation or persistence fails:

- parent remains unchanged,
- no false `specimen-forked` success event is committed,
- no child is shown as created,
- the user can retry.

If the child is successfully persisted but UI navigation fails, the child still exists in saved specimens.

Scar creation and drift calculation must not make model calls and should not block ordinary chat.

## 24. Cost discipline

Normal conversation remains one Gemini request per user turn.

Forking itself requires no model call unless a future explicit naming/synthesis feature chooses to use one.

Scar creation is deterministic application logic for automatic scar types.

Drift calculation is deterministic application logic.

Round 2B must not add:

- hidden agents,
- repeated critique,
- hidden lineage analysis calls,
- automatic embedding calls,
- or FUSE recompilation merely because a specimen forks.

A forked FUSE specimen copies the parent's current persisted compiled kernel as part of the inherited current genome/birth state.

## 25. Data integrity invariants

1. A fork never mutates the parent.
2. Every child has a new specimen ID.
3. Child conversation starts fresh.
4. Child artifacts/checkpoints/life history begin child-local.
5. Child birth genome equals the parent's current genome at the fork moment.
6. Child active traits equal cloned parent active traits at the fork moment.
7. Child active infections equal cloned parent active infections with the same remaining durations.
8. Inherited mutable records receive new child-local IDs.
9. Inherited records preserve source specimen/source record references.
10. Parent retired traits and inactive infection records do not cross the fork boundary.
11. Parent checkpoints do not cross the fork boundary.
12. Scars never alter runtime prompt behavior by themselves.
13. Checkpoint restore never erases scars or life-history evidence.
14. Lifetime drift compares against the specimen's own birth baseline.
15. Forked children begin at zero lifetime drift.
16. Generation is lineage context, not lifetime-drift weight.
17. Drift uses application-owned state only.
18. Drift UI explains its dimensions.
19. No feature claims to measure hidden neural/latent/model-weight change.
20. Storage migration preserves existing Round 2A data.
21. Normal chat remains one model call by default.

## 26. Acceptance scenarios

### 26.1 Basic fork

A spawned specimen has:

- current genome G2,
- two active acquired traits,
- one retired trait,
- one active infection with 3 turns remaining,
- one expired infection,
- four scars,
- messages/artifacts/checkpoints.

User asks to fork it and approves.

Expected child:

- new specimen ID,
- generation parent + 1,
- parent/root references,
- birth/current genome cloned from G2,
- two active traits cloned with new IDs,
- no retired trait copy,
- one active infection cloned with a new ID and 3 turns remaining,
- no expired infection copy,
- four inherited scars cloned with new IDs,
- fresh conversation with compact fork-birth note,
- no copied artifacts,
- no copied checkpoints,
- child life history containing birth-from-fork/inherited-scar events,
- zero lifetime drift.

Expected parent:

- unchanged behavioral state,
- child-fork event recorded only after successful child persistence.

### 26.2 Divergent children

Parent is forked twice into Child A and Child B.

Child A promotes an infection and later changes genome.

Child B does neither and accumulates one experienced scar.

Expected:

- parent remains independent,
- A and B have distinct IDs and life histories,
- A and B can have different drift bands,
- changes to A never alter B or parent,
- future comparisons can identify common parent/root.

### 26.3 Scar without behavior

A temporary infection expires naturally and creates an experienced scar.

Expected:

- scar appears in history/lineage panel,
- no new acquired trait appears,
- runtime prompt is unchanged after infection expiry,
- drift dimensions reflect the experienced scar/mutation history,
- user may later explicitly promote relevant history into a trait through a separate approved action.

### 26.4 Checkpoint restore after scar

Specimen fossilizes behavior, receives a scar, then restores the pre-fossil checkpoint.

Expected:

- acquired trait is removed/restored according to checkpoint state,
- fossilization and restore remain in life history,
- historical scar remains,
- drift explanation can show reversion activity even though persistent state moved closer to birth.

### 26.5 Migrated Round 2A specimen

Existing schema-v2 specimen loads after Round 2B upgrade.

Expected:

- no data loss,
- schema becomes v3,
- existing mutation/life-history data remains,
- specimen becomes a root lineage record,
- scars become typed empty/default state unless factual scars can be derived without fabrication,
- drift baseline is marked migrated if exact lifetime baseline cannot be reconstructed.

## 27. UI acceptance

The normal chat header remains uncluttered.

When lineage data exists, a compact strip such as:

`GEN 2 · 3 SCARS · DRIFT: MODERATE`

may appear near mutation status.

Opening it shows concise factual details rather than a dashboard.

Fork confirmation uses the existing blocking structural-decision visual language.

After fork persistence, the user gets:

- **OPEN CHILD**
- **STAY WITH PARENT**

No full family tree is required in Round 2B.

## 28. Testing strategy

Implementation should be test-first.

Required test groups:

1. **Schema v3 migration**
   - v2 → v3 data preservation
   - root lineage creation
   - baseline quality marker
   - typed scar defaults

2. **Fork engine**
   - parent immutability
   - child-local IDs
   - active-state inheritance
   - fresh conversation
   - no artifact/checkpoint copying
   - active infection duration preserved independently
   - FUSE compiled kernel copied without recompilation

3. **Scar engine**
   - deterministic automatic scar rules
   - experienced versus inherited
   - restore does not erase scars
   - scars do not enter runtime prompt

4. **Drift engine**
   - deterministic dimensions
   - zero drift at root birth
   - zero lifetime drift immediately after fork
   - band thresholds
   - inherited state excluded from child lifetime drift
   - genome change weighted more than temporary history
   - explainable summaries

5. **UI**
   - compact lineage/drift strip
   - fork approval
   - fork success choices
   - open-child/stay-parent behavior
   - no parent mutation before child persistence

6. **End-to-end acceptance**
   - mutate parent
   - fork
   - diverge child
   - persist/reload
   - verify parent/child independence
   - verify scars/drift/lineage after reload

## 29. Suggested implementation decomposition

A later implementation plan should likely separate Round 2B into jobs roughly along these boundaries:

1. schema v3 + lineage/birth-baseline/scar types + v2 migration,
2. pure fork engine and inheritance cloning,
3. scar engine and life-history integration,
4. deterministic drift engine,
5. response-envelope and conversational fork proposal/action,
6. UI and saved-specimen integration,
7. final persistence/provenance/end-to-end acceptance cleanup.

Exact job boundaries may change after implementation planning.

## 30. Explicitly deferred beyond Round 2B

- breeding/recombination,
- inheritance of two parents,
- dominant/recessive rules,
- phenotype scoring,
- mate selection,
- generation comparison dashboard,
- full lineage/family-tree visualization,
- artifact inheritance,
- cross-specimen evidence browser,
- Petri Dish competitions,
- automatic evolution/ecology,
- Semantic Manifold/SRE/TOPOS,
- external state controllers,
- cloud sync.

## 31. Completion criteria

Round 2B is complete when:

- specimens can be forked safely inside the same app,
- parent state remains independent,
- children inherit active state with child-local identity,
- children start fresh conversations and fresh checkpoints/artifacts,
- lineage is persisted,
- scars are structured historical state,
- scars do not silently affect behavior,
- drift is deterministic and explainable,
- forked children begin at zero lifetime drift,
- schema-v2 specimens migrate safely to v3,
- persistence/reload preserves lineage/scars/baselines,
- ordinary chat remains one model call by default,
- all tests, typecheck, and production build pass.
