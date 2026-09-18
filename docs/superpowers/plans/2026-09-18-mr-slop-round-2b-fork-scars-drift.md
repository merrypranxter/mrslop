# Mr. Slop Round 2B Forking, Scars, and Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe in-app specimen forking, durable non-behavioral scars, and deterministic explainable lifetime drift while preserving Round 2A mutation semantics and one-call ordinary chat.

**Architecture:** Upgrade specimens to schema v3 with typed lineage, birth-baseline, scar, and inheritance records. Keep fork/scar/drift logic in pure focused libraries, keep persistence in the existing specimen store, and let `App.tsx` own atomic fork persistence because it owns the saved-specimen collection. Mr. Slop may conversationally request a fork, but the app owns approval, creation, lineage, drift, and persistence.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, LocalForage, existing Express/Vite + Gemini server transport, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-09-18-mr-slop-round-2b-fork-scars-drift-design.md`

## Global Constraints

- "Fork" means an in-app specimen fork; the codebase remains one `merrypranxter/mrslop` repository merged to `main`.
- Child conversation is fresh; parent messages, artifacts, checkpoints, retired traits, inactive infections, and full life history are not copied.
- Child inherits parent current genome, active traits, active infections with remaining duration, and scars as child-local inherited records.
- Forked child birth baseline is captured after child-local inherited IDs are created; immediate lifetime drift is exactly zero.
- Scars are historical data only and never become runtime prompt instructions automatically.
- Lifetime drift uses only application-owned state; no embeddings, hidden-state claims, or extra model calls.
- Drift scoring is fixed by the approved spec: genome component delta +4 each, mode +3, seed +2, active post-baseline trait +3, retired trait +2, distinct post-baseline infection +1 capped at 4, experienced post-baseline scar +1 capped at 4, restore +1 capped at 3.
- Drift bands are LOW 0–2, MODERATE 3–7, HIGH 8–14, EXTREME 15+.
- The LocalForage key remains exactly `mrslop_specimens_v1`; stored specimen schema becomes version 3.
- Schema-v2 migration must preserve all Round 2A data and must under-claim historical drift rather than fabricate chronology.
- Fork persistence is atomic from the UI's point of view: save parent-with-fork-event and child in one specimen-list write before updating React state.
- A fork never triggers FUSE recompilation; an existing compiled FUSE kernel is copied with the genome snapshot.
- Ordinary chat remains one Gemini request per successful user turn by default.
- No breeding, two-parent inheritance, full family tree, Petri Dish, Semantic Manifold/SRE/TOPOS, external controller, or cloud sync work belongs in Round 2B.
- Never read, migrate, or delete `ghost_sessions`.

---

## File Structure

### New focused files

- `lib/lineage.ts` — pure fork creation, child-local inheritance cloning, fork naming helper, parent/child life-history records.
- `lib/scars.ts` — scar creation/deduplication helpers and deterministic scar constructors.
- `lib/drift.ts` — pure drift dimensions, scoring, band assignment, deterministic explanation.
- `components/LineageStatus.tsx` — compact `GEN · SCARS · DRIFT` strip and details panel.
- `components/ForkResultCard.tsx` — post-persist `OPEN CHILD` / `STAY WITH PARENT` action surface.
- `tests/round2bMigration.test.ts`
- `tests/lineageFork.test.ts`
- `tests/scars.test.ts`
- `tests/drift.test.ts`
- `tests/forkEnvelope.test.ts`
- `tests/forkUI.test.tsx`
- `tests/round2bAcceptance.test.tsx`

### Existing files modified

- `types.ts` — schema v3 types and fork response-envelope type.
- `services/specimenStore.ts` — v1/v2→v3 migration, typed clones/validation, v3 specimen creation.
- `lib/mutations.ts` — close Round 2A active-infection cap/order invariant; create scars at approved mutation lifecycle points.
- `lib/kernel.ts` — regression-only verification that scars never enter prompt layers.
- `services/geminiService.ts` — validate `forkAction` in the same response envelope.
- `prompts/mrSlopBase.ts` — conversational fork semantics and technical honesty.
- `components/MrSlopTerminal.tsx` — fork approval, lineage status, scar-aware summary, post-fork result UI.
- `components/SpecimenSidebar.tsx` — show generation/drift compactly in saved specimens.
- `components/ConversationUI.css` — compact lineage/fork styles only.
- `App.tsx` — collection-level atomic fork persistence and opening the new child.
- `README.md` — Round 2B behavior and schema-v3 documentation.

---

### Task 1: Close Round 2A mutation invariants before lineage work

**Files:**
- Modify: `lib/mutations.ts`
- Modify: `tests/mutations.test.ts`
- Modify: `tests/mutationKernel.test.ts`

**Interfaces:**
- Consumes: existing `startInfection(specimen, proposal, duration)`, `activeInfections(specimen)`, `activeTraits(specimen)`, `compileMutationRuntimeLayer(traits, infections)`.
- Produces: `export const MAX_ACTIVE_INFECTIONS = 3`; deterministic active-record ordering by `createdAt`, then `id`.

- [ ] **Step 1: Add failing cap and ordering tests**

Add tests equivalent to:

```ts
import {
  MAX_ACTIVE_INFECTIONS,
  activeInfections,
  activeTraits,
  startInfection,
} from '../lib/mutations';

it('rejects a fourth active infection without changing the specimen', () => {
  expect(MAX_ACTIVE_INFECTIONS).toBe(3);
  const three = [p1, p2, p3].reduce(
    (current, proposal) => startInfection(current, proposal, { mode: 'indefinite' }),
    specimenFixture(),
  );

  expect(() =>
    startInfection(three, p4, { mode: 'indefinite' }),
  ).toThrow('ACTIVE_INFECTION_LIMIT');
  expect(three.infections.filter(item => item.status === 'active')).toHaveLength(3);
});

it('frees an infection slot after expiry/removal/promotion', () => {
  const three = buildThreeActiveInfections();
  const removed = removeInfection(three, three.infections[0].id);
  expect(() =>
    startInfection(removed, p4, { mode: 'indefinite' }),
  ).not.toThrow();
});

it('sorts active traits and infections by createdAt then id', () => {
  const specimen = specimenWithIntentionallyUnorderedMutationRecords();
  expect(activeInfections(specimen).map(item => item.id)).toEqual(['a', 'b', 'c']);
  expect(activeTraits(specimen).map(item => item.id)).toEqual(['t-a', 't-b']);
});
```

In `tests/mutationKernel.test.ts`, add a test that passes deliberately unordered active records and expects the emitted trait/infection blocks in the same `createdAt/id` order.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- tests/mutations.test.ts tests/mutationKernel.test.ts
```

Expected: failures because the cap constant/guard and deterministic sorting do not exist yet.

- [ ] **Step 3: Implement the invariant minimally**

In `lib/mutations.ts` add:

```ts
export const MAX_ACTIVE_INFECTIONS = 3;

const byCreatedAtThenId = <T extends { createdAt: number; id: string }>(a: T, b: T) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);
```

At the start of `startInfection`, after validating proposal kind and before constructing state:

```ts
if (specimen.infections.filter(item => item.status === 'active').length >= MAX_ACTIVE_INFECTIONS) {
  throw new Error('ACTIVE_INFECTION_LIMIT');
}
```

Change `activeInfections`, `activeTraits`, and the active arrays inside `compileMutationRuntimeLayer` to sort cloned/filter results with `byCreatedAtThenId`.

- [ ] **Step 4: Run focused tests and full gate**

Run:

```bash
npm test -- tests/mutations.test.ts tests/mutationKernel.test.ts
npm test
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add lib/mutations.ts tests/mutations.test.ts tests/mutationKernel.test.ts
git commit -m "fix: enforce mutation runtime invariants"
```

---

### Task 2: Add schema v3 lineage, scar, inheritance, and birth-baseline persistence

**Files:**
- Modify: `types.ts`
- Modify: `services/specimenStore.ts`
- Create: `tests/round2bMigration.test.ts`
- Modify: `tests/specimenStore.test.ts`
- Modify: `tests/mutationMigration.test.ts`

**Interfaces:**
- Consumes: existing `Genome`, `AcquiredTrait`, `Infection`, `LifeHistoryEvent`, `Specimen`.
- Produces:
  - `InheritanceRef`
  - `ScarKind`, `ScarOrigin`, `Scar`
  - `LineageRecord`
  - `DriftBaseline`
  - schema-v3 `Specimen`
  - `captureBirthBaseline(specimen: Specimen, genome: Genome, source: DriftBaseline['source'], capturedAt?: number): DriftBaseline`
  - `migrateSpecimen(value: unknown): Specimen | null` returning v3 only.

- [ ] **Step 1: Add exact schema-v3 type definitions**

Update `types.ts` with these shapes:

```ts
export interface InheritanceRef {
  specimenId: string;
  recordId: string;
  inheritedAt: number;
}

export type ScarOrigin = 'experienced' | 'inherited';
export type ScarKind =
  | 'infection-survived'
  | 'infection-promoted'
  | 'fossilized-accident'
  | 'checkpoint-reversion'
  | 'genome-change'
  | 'fork-birth';

export interface Scar {
  id: string;
  name: string;
  description: string;
  kind: ScarKind;
  origin: ScarOrigin;
  createdAt: number;
  sourceSpecimenId?: string;
  sourceScarId?: string;
  inheritedAt?: number;
  relatedEventIds: string[];
  relatedMutationIds: string[];
  relatedCheckpointIds: string[];
  messageIds: string[];
  artifactIds: string[];
}

export interface LineageRecord {
  rootSpecimenId: string;
  parentSpecimenId: string | null;
  generation: number;
  forkedAt?: number;
  forkSourceEventId?: string;
  forkSourceCheckpointId?: string;
  forkSourceGenomeId?: string;
  source: 'native-v3' | 'fork-v3' | 'migrated-v2';
}

export interface DriftBaseline {
  capturedAt: number;
  source: 'native-v3' | 'fork-v3' | 'migrated-v2';
  genome: Genome;
  activeTraitIds: string[];
  activeInfectionIds: string[];
  inheritedScarIds: string[];
}
```

Add optional `inheritedFrom?: InheritanceRef` to `AcquiredTrait` and `Infection`.

Extend `LifeHistoryEventType` with:

```ts
| 'specimen-forked'
| 'specimen-born-from-fork'
| 'scar-acquired'
| 'scar-inherited'
```

Extend `LifeHistoryEvent` with optional:

```ts
scarId?: string;
relatedSpecimenId?: string;
```

Change `Specimen` to:

```ts
export interface Specimen {
  schemaVersion: 3;
  // existing fields unchanged...
  scars: Scar[];
  birthBaseline: DriftBaseline;
  lineage: LineageRecord;
}
```

Keep `trajectory`, `controllerState`, and `metrics` as their existing placeholders.

- [ ] **Step 2: Write migration tests before store implementation**

Create `tests/round2bMigration.test.ts` covering:

```ts
it('migrates v2 to v3 without losing Round 2A state', () => {
  const v2 = legacyV2FixtureWithMessagesArtifactsMutationsAndHistory();
  const migrated = migrateSpecimen(v2)!;

  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.id).toBe(v2.id);
  expect(migrated.messages).toEqual(v2.messages);
  expect(migrated.artifacts).toEqual(v2.artifacts);
  expect(migrated.acquiredTraits).toEqual(v2.acquiredTraits);
  expect(migrated.infections).toEqual(v2.infections);
  expect(migrated.lifeHistory).toEqual(v2.lifeHistory);
  expect(migrated.lineage).toEqual({
    rootSpecimenId: v2.id,
    parentSpecimenId: null,
    generation: 0,
    source: 'migrated-v2',
  });
  expect(migrated.birthBaseline.source).toBe('migrated-v2');
  expect(migrated.birthBaseline.activeTraitIds).toEqual(
    v2.acquiredTraits.filter(t => t.status === 'active').map(t => t.id),
  );
  expect(migrated.birthBaseline.activeInfectionIds).toEqual(
    v2.infections.filter(i => i.status === 'active').map(i => i.id),
  );
});

it('does not fabricate scars from opaque v2 placeholder scar data', () => {
  const migrated = migrateSpecimen({ ...legacyV2Fixture(), scars: [{ mystery: true }] })!;
  expect(migrated.scars).toEqual([]);
});

it('creates native-v3 roots with immutable zero-drift birth state', () => {
  const specimen = makeSpecimen(genome, 'ROOT');
  expect(specimen.schemaVersion).toBe(3);
  expect(specimen.lineage).toMatchObject({
    rootSpecimenId: specimen.id,
    parentSpecimenId: null,
    generation: 0,
    source: 'native-v3',
  });
  expect(specimen.birthBaseline.genome).toEqual(specimen.birthGenome);
  expect(specimen.birthBaseline.activeTraitIds).toEqual([]);
  expect(specimen.birthBaseline.activeInfectionIds).toEqual([]);
  expect(specimen.birthBaseline.inheritedScarIds).toEqual([]);
});

it('can capture the final birth baseline for a building specimen when it spawns', () => {
  const building = makeSpecimen(emptyGenome, 'NEW SPECIMEN', 'building');
  const baseline = captureBirthBaseline(building, installedGenome, 'native-v3', 1234);
  expect(baseline.capturedAt).toBe(1234);
  expect(baseline.genome).toEqual(installedGenome);
  expect(baseline.activeTraitIds).toEqual([]);
  expect(baseline.activeInfectionIds).toEqual([]);
});
```

Update existing migration/store tests to expect schema v3 rather than schema v2.

- [ ] **Step 3: Run migration tests and verify RED**

Run:

```bash
npm test -- tests/round2bMigration.test.ts tests/specimenStore.test.ts tests/mutationMigration.test.ts
```

Expected: type/test failures because schema v3, lineage, and baseline fields are missing.

- [ ] **Step 4: Implement v3 clone/validation/migration**

In `services/specimenStore.ts`:

1. Add local `LegacyV2Specimen` matching the pre-v3 shape.
2. Preserve the existing v1 migration path by first normalizing v1 data to a v2-like in-memory object.
3. Add focused clone helpers:

```ts
const cloneScar = (scar: Scar): Scar => ({
  ...scar,
  relatedEventIds: [...scar.relatedEventIds],
  relatedMutationIds: [...scar.relatedMutationIds],
  relatedCheckpointIds: [...scar.relatedCheckpointIds],
  messageIds: [...scar.messageIds],
  artifactIds: [...scar.artifactIds],
});

const cloneBaseline = (baseline: DriftBaseline): DriftBaseline => ({
  ...baseline,
  genome: cloneGenomeSnapshot(baseline.genome),
  activeTraitIds: [...baseline.activeTraitIds],
  activeInfectionIds: [...baseline.activeInfectionIds],
  inheritedScarIds: [...baseline.inheritedScarIds],
});
```

4. Add strict `isScar`, `isLineageRecord`, `isDriftBaseline`, and v3 specimen validators.
5. Convert v2 specimens conservatively:

```ts
const migrateV2ToV3 = (value: LegacyV2Specimen): Specimen => ({
  ...cloneExistingV2Fields(value),
  schemaVersion: 3,
  scars: [],
  lineage: {
    rootSpecimenId: value.id,
    parentSpecimenId: null,
    generation: 0,
    source: 'migrated-v2',
  },
  birthBaseline: {
    capturedAt: Date.now(),
    source: 'migrated-v2',
    genome: cloneGenomeSnapshot(value.birthGenome),
    activeTraitIds: value.acquiredTraits
      .filter(trait => trait.status === 'active')
      .map(trait => trait.id),
    activeInfectionIds: value.infections
      .filter(infection => infection.status === 'active')
      .map(infection => infection.id),
    inheritedScarIds: [],
  },
});
```

6. Add `captureBirthBaseline` as a small snapshot helper:

```ts
export const captureBirthBaseline = (
  specimen: Specimen,
  genome: Genome,
  source: DriftBaseline['source'],
  capturedAt = Date.now(),
): DriftBaseline => ({
  capturedAt,
  source,
  genome: cloneGenomeSnapshot(genome),
  activeTraitIds: specimen.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(trait => trait.id),
  activeInfectionIds: specimen.infections
    .filter(infection => infection.status === 'active')
    .map(infection => infection.id),
  inheritedScarIds: specimen.scars
    .filter(scar => scar.origin === 'inherited')
    .map(scar => scar.id),
});
```

7. Update `makeSpecimen` to create native-v3 root lineage and baseline in the same construction. For a `building` specimen the initial empty baseline is provisional; Task 7 must replace it exactly once when the selected genome is installed and the specimen enters `spawned`.

Do not change `MR_SLOP_STORAGE_KEY`.

- [ ] **Step 5: Run migration/store tests and full gate**

Run:

```bash
npm test -- tests/round2bMigration.test.ts tests/specimenStore.test.ts tests/mutationMigration.test.ts
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add types.ts services/specimenStore.ts tests/round2bMigration.test.ts tests/specimenStore.test.ts tests/mutationMigration.test.ts
git commit -m "feat: add schema v3 lineage baseline and scars"
```

---

### Task 3: Build the pure fork engine with child-local inheritance

**Files:**
- Create: `lib/lineage.ts`
- Create: `tests/lineageFork.test.ts`

**Interfaces:**
- Consumes: schema-v3 `Specimen`, `AcquiredTrait`, `Infection`, `Scar`, `Role`.
- Produces:

```ts
export interface ForkSpecimenResult {
  parent: Specimen;
  child: Specimen;
}

export const nextForkName = (parent: Specimen, siblings: Specimen[]): string;
export const forkSpecimen = (
  parent: Specimen,
  childName: string,
  now?: number,
): ForkSpecimenResult;
```

- [ ] **Step 1: Write fork behavior tests**

Create tests for all inheritance boundaries:

```ts
it('forks active state into child-local records without mutating input parent', () => {
  const parent = parentFixture({
    activeTraits: 2,
    retiredTraits: 1,
    activeInfections: [{ remainingTurns: 3 }],
    expiredInfections: 1,
    scars: 2,
    messages: 5,
    artifacts: 2,
    checkpoints: 2,
  });
  const frozen = structuredClone(parent);

  const { parent: updatedParent, child } = forkSpecimen(parent, 'PARENT / FORK 1', 1000);

  expect(parent).toEqual(frozen);
  expect(child.id).not.toBe(parent.id);
  expect(child.lineage).toMatchObject({
    rootSpecimenId: parent.lineage.rootSpecimenId,
    parentSpecimenId: parent.id,
    generation: parent.lineage.generation + 1,
    forkedAt: 1000,
    forkSourceGenomeId: parent.currentGenome.id,
    source: 'fork-v3',
  });
  expect(child.birthGenome).toEqual(parent.currentGenome);
  expect(child.currentGenome).toEqual(parent.currentGenome);
  expect(child.acquiredTraits).toHaveLength(2);
  expect(child.acquiredTraits.every(t => t.status === 'active')).toBe(true);
  expect(child.acquiredTraits.map(t => t.id)).not.toEqual(
    parent.acquiredTraits.filter(t => t.status === 'active').map(t => t.id),
  );
  expect(child.infections).toHaveLength(1);
  expect(child.infections[0].remainingTurns).toBe(3);
  expect(child.artifacts).toEqual([]);
  expect(child.checkpoints).toEqual([]);
  expect(child.messages).toHaveLength(1);
  expect(child.messages[0].role).toBe(Role.SYSTEM);
  expect(updatedParent.lifeHistory.at(-1)).toMatchObject({
    type: 'specimen-forked',
    relatedSpecimenId: child.id,
  });
});

it('copies a persisted FUSE kernel without recompilation', () => {
  const parent = parentWithFuseKernel('compiled-parent-kernel');
  const { child } = forkSpecimen(parent, 'CHILD', 1000);
  expect(child.currentGenome.compiledKernel).toBe('compiled-parent-kernel');
  expect(child.birthGenome.compiledKernel).toBe('compiled-parent-kernel');
});

it('creates inherited child-local scars plus a zero-drift fork-birth scar', () => {
  const { child } = forkSpecimen(parentWithScars(2), 'CHILD', 1000);
  expect(child.scars).toHaveLength(3);
  expect(child.scars.every(scar => scar.origin === 'inherited')).toBe(true);
  expect(child.scars.some(scar => scar.kind === 'fork-birth')).toBe(true);
  expect(child.birthBaseline.inheritedScarIds.sort()).toEqual(
    child.scars.map(scar => scar.id).sort(),
  );
});

it('captures the child baseline after child-local IDs exist', () => {
  const { child } = forkSpecimen(parentWithActiveMutationState(), 'CHILD', 1000);
  expect(child.birthBaseline.source).toBe('fork-v3');
  expect(child.birthBaseline.activeTraitIds).toEqual(child.acquiredTraits.map(t => t.id));
  expect(child.birthBaseline.activeInfectionIds).toEqual(child.infections.map(i => i.id));
});
```

Also test `nextForkName` returns `PARENT / FORK 1`, then `PARENT / FORK 2` based on existing child lineage, not by parsing arbitrary unrelated names.

- [ ] **Step 2: Run fork tests and verify RED**

Run:

```bash
npm test -- tests/lineageFork.test.ts
```

Expected: fail because `lib/lineage.ts` does not exist.

- [ ] **Step 3: Implement child-local clone helpers and fork engine**

In `lib/lineage.ts`, use pure clone helpers and a new UUID for each inherited trait/infection/scar.

Trait inheritance must preserve the original mutation provenance but add:

```ts
inheritedFrom: {
  specimenId: parent.id,
  recordId: trait.id,
  inheritedAt: now,
}
```

Infection inheritance does the same and preserves `remainingTurns`.

Inherited scars are cloned with:

```ts
{
  ...scar,
  id: crypto.randomUUID(),
  origin: 'inherited',
  sourceSpecimenId: parent.id,
  sourceScarId: scar.id,
  inheritedAt: now,
}
```

Create a special fork-birth scar:

```ts
const forkBirthScar: Scar = {
  id: crypto.randomUUID(),
  name: 'Born from a fork',
  description: `Forked from ${parent.name} at generation ${parent.lineage.generation + 1}.`,
  kind: 'fork-birth',
  origin: 'inherited',
  createdAt: now,
  sourceSpecimenId: parent.id,
  inheritedAt: now,
  relatedEventIds: [],
  relatedMutationIds: [],
  relatedCheckpointIds: [],
  messageIds: [],
  artifactIds: [],
};
```

Create one child system message containing only factual inherited-state counts.

Child `birthBaseline` must be built **after** child-local records exist.

Parent result differs from input only by appended `specimen-forked` life-history event and `lastModified`.

Child life history starts with `specimen-born-from-fork` plus `scar-inherited` events; it does not copy parent history.

- [ ] **Step 4: Run fork tests and full gate**

Run:

```bash
npm test -- tests/lineageFork.test.ts
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/lineage.ts tests/lineageFork.test.ts
git commit -m "feat: add pure specimen fork engine"
```

---

### Task 4: Add deterministic scar creation to meaningful lifecycle events

**Files:**
- Create: `lib/scars.ts`
- Create: `tests/scars.test.ts`
- Modify: `lib/mutations.ts`
- Modify: `services/specimenStore.ts`
- Modify: `components/MrSlopTerminal.tsx`
- Modify: `tests/mutations.test.ts`
- Modify: `tests/mutationUI.test.tsx`

**Interfaces:**
- Consumes: schema-v3 `Specimen`, mutation lifecycle functions, checkpoint restoration, explicit genome changes.
- Produces:

```ts
export const addExperiencedScar = (specimen: Specimen, scar: Omit<Scar, 'id' | 'origin' | 'createdAt'>, now?: number): Specimen;
export const hasEquivalentScar = (specimen: Specimen, kind: ScarKind, relatedId: string): boolean;
export const addInfectionSurvivedScar = (specimen: Specimen, infection: Infection, eventId: string, now?: number): Specimen;
export const addPromotionScar = (specimen: Specimen, infectionId: string, traitId: string, eventIds: string[], now?: number): Specimen;
export const addFossilizationScar = (specimen: Specimen, traitId: string, eventIds: string[], now?: number): Specimen;
export const addCheckpointReversionScar = (before: Specimen, restored: Specimen, checkpointId: string, eventId: string, now?: number): Specimen;
export const addGenomeChangeScar = (specimen: Specimen, previousGenomeId: string, nextGenomeId: string, now?: number): Specimen;
```

- [ ] **Step 1: Write scar-engine tests**

Cover exactly the automatic rules:

```ts
it('adds an experienced scar when a limited infection naturally expires', () => {
  const next = advanceSuccessfulTurn(oneTurnInfectedSpecimen());
  expect(next.scars).toContainEqual(expect.objectContaining({
    kind: 'infection-survived',
    origin: 'experienced',
  }));
  expect(next.lifeHistory.some(event => event.type === 'scar-acquired')).toBe(true);
});

it('adds one promotion scar and does not duplicate it on repeated helper calls', () => {
  const promoted = promoteInfection(activeInfectionSpecimen(), infectionId);
  expect(promoted.scars.filter(s => s.kind === 'infection-promoted')).toHaveLength(1);
});

it('fossilization creates a historical scar but the scar prompt is never compiled', () => {
  const fossilized = fossilizeAccident(specimenFixture(), fossilProposal);
  expect(fossilized.scars.some(s => s.kind === 'fossilized-accident')).toBe(true);

  const instruction = assembleSystemInstruction({
    phase: 'spawned',
    catalogIndex: '',
    genome: fossilized.currentGenome,
    acquiredTraits: [],
    infections: [],
    specimenState: 'state only',
  });
  expect(instruction).not.toContain(fossilized.scars[0].description);
});

it('checkpoint restore preserves old scars and adds reversion scar only when lasting state changed', () => {
  const restored = restoreCheckpoint(specimenWithPostCheckpointTraitAndScar(), checkpointId);
  expect(restored.scars.some(s => s.kind === 'fossilized-accident')).toBe(true);
  expect(restored.scars.some(s => s.kind === 'checkpoint-reversion')).toBe(true);
});
```

Add a UI/structural test that an approved genome replacement creates exactly one `genome-change` scar.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- tests/scars.test.ts tests/mutations.test.ts tests/mutationUI.test.tsx
```

Expected: failures because typed scar helpers/integration do not exist.

- [ ] **Step 3: Implement `lib/scars.ts` as pure append-only history logic**

`addExperiencedScar` must:

1. create a new `Scar` with `origin: 'experienced'`,
2. append exactly one `scar-acquired` life-history event referencing the scar ID,
3. never remove existing scars,
4. update `lastModified`,
5. never alter genome/traits/infections.

Deduplicate automatic scars using stable related IDs so rerender/retry cannot create duplicates.

- [ ] **Step 4: Wire scars into existing lifecycle functions**

In `lib/mutations.ts`:

- when `advanceSuccessfulTurn` expires an infection, add `infection-survived` scar;
- when `promoteInfection` succeeds, add `infection-promoted` scar;
- when `fossilizeAccident` succeeds, add `fossilized-accident` scar.

In `services/specimenStore.ts`:

- after `restoreCheckpoint` constructs restored state and history, call `addCheckpointReversionScar` only if genome/active-trait/active-infection state actually differs from the pre-restore state.

In `MrSlopTerminal.tsx`:

- after approved genome replacement succeeds, append a `genome-mutated` life-history event containing the previous/new genome relationship;
- then call `addGenomeChangeScar` with the previous genome ID, new genome ID, and the new history-event ID before committing.

`addGenomeChangeScar` must reference that `genome-mutated` event from the scar so the scar is evidence-backed rather than a disconnected label.

- [ ] **Step 5: Run focused tests and full gate**

Run:

```bash
npm test -- tests/scars.test.ts tests/mutations.test.ts tests/mutationUI.test.tsx
npm test
npm run lint
npm run build
```

Expected: all pass; existing mutation behavior remains intact.

- [ ] **Step 6: Commit**

```bash
git add lib/scars.ts lib/mutations.ts services/specimenStore.ts components/MrSlopTerminal.tsx tests/scars.test.ts tests/mutations.test.ts tests/mutationUI.test.tsx
git commit -m "feat: record durable specimen scars"
```

---

### Task 5: Add deterministic, explainable lifetime drift

**Files:**
- Create: `lib/drift.ts`
- Create: `tests/drift.test.ts`

**Interfaces:**
- Consumes: `Specimen.birthBaseline`, current genome, traits, life history, scars.
- Produces:

```ts
export type DriftBand = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export interface DriftDimensions {
  genomeComponentDelta: number;
  genomeModeChanged: boolean;
  customSeedChanged: boolean;
  activeLifetimeTraits: number;
  retiredLifetimeTraits: number;
  lifetimeInfections: number;
  experiencedScars: number;
  checkpointRestores: number;
  generation: number;
}

export interface DriftReport {
  score: number;
  band: DriftBand;
  dimensions: DriftDimensions;
  explanation: string;
}

export const calculateDrift = (specimen: Specimen): DriftReport;
```

- [ ] **Step 1: Write exact drift scoring tests**

Create `tests/drift.test.ts` with deterministic timestamps and fixtures.

Required assertions:

```ts
it('returns LOW score zero for a new root', () => {
  expect(calculateDrift(makeSpecimen(genome, 'ROOT'))).toMatchObject({
    score: 0,
    band: 'LOW',
  });
});

it('returns score zero immediately after a fork despite inherited state and fork-birth scar', () => {
  const { child } = forkSpecimen(complexParentFixture(), 'CHILD', 1000);
  const report = calculateDrift(child);
  expect(report.score).toBe(0);
  expect(report.band).toBe('LOW');
  expect(report.dimensions.generation).toBe(child.lineage.generation);
});

it('weights genome change more than one temporary infection', () => {
  const infectionOnly = specimenWithOnePostBaselineInfection();
  const genomeChanged = specimenWithOneComponentAddedAfterBaseline();
  expect(calculateDrift(genomeChanged).score)
    .toBeGreaterThan(calculateDrift(infectionOnly).score);
});

it.each([
  [0, 'LOW'],
  [2, 'LOW'],
  [3, 'MODERATE'],
  [7, 'MODERATE'],
  [8, 'HIGH'],
  [14, 'HIGH'],
  [15, 'EXTREME'],
])('maps score %i to %s', (score, band) => {
  expect(bandForScore(score)).toBe(band);
});
```

Also verify infection/scar/restore caps and that inherited scars are excluded.

- [ ] **Step 2: Run drift tests and verify RED**

Run:

```bash
npm test -- tests/drift.test.ts
```

Expected: fail because `lib/drift.ts` does not exist.

- [ ] **Step 3: Implement exact scoring**

In `lib/drift.ts`:

```ts
export const bandForScore = (score: number): DriftBand => {
  if (score >= 15) return 'EXTREME';
  if (score >= 8) return 'HIGH';
  if (score >= 3) return 'MODERATE';
  return 'LOW';
};
```

Compute enabled-component symmetric difference between baseline genome and current genome.

Compute score exactly:

```ts
const score =
  dimensions.genomeComponentDelta * 4 +
  (dimensions.genomeModeChanged ? 3 : 0) +
  (dimensions.customSeedChanged ? 2 : 0) +
  dimensions.activeLifetimeTraits * 3 +
  dimensions.retiredLifetimeTraits * 2 +
  Math.min(dimensions.lifetimeInfections, 4) +
  Math.min(dimensions.experiencedScars, 4) +
  Math.min(dimensions.checkpointRestores, 3);
```

Count post-baseline time using `birthBaseline.capturedAt`, but exclude baseline IDs explicitly where IDs are available.

Generate explanation deterministically from dimensions; do not call Gemini. Example construction:

```ts
const reasons = [
  dimensions.genomeComponentDelta ? `${dimensions.genomeComponentDelta} genome component changes` : 'genome components unchanged',
  dimensions.activeLifetimeTraits ? `${dimensions.activeLifetimeTraits} active lifetime traits` : null,
  dimensions.retiredLifetimeTraits ? `${dimensions.retiredLifetimeTraits} retired lifetime traits` : null,
  dimensions.experiencedScars ? `${dimensions.experiencedScars} experienced scars` : null,
].filter(Boolean);

const explanation = reasons.join(' · ');
```

For `migrated-v2` baselines, prepend/append a short note: `Historical baseline is conservative from the Round 2A migration.`

- [ ] **Step 4: Run drift tests and full gate**

Run:

```bash
npm test -- tests/drift.test.ts
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/drift.ts tests/drift.test.ts
git commit -m "feat: calculate explainable specimen drift"
```

---

### Task 6: Add conversational fork request to the existing one-call envelope

**Files:**
- Modify: `types.ts`
- Modify: `services/geminiService.ts`
- Modify: `prompts/mrSlopBase.ts`
- Create: `tests/forkEnvelope.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ForkActionRequest {
  type: 'fork-specimen';
  suggestedName?: string;
  reason: string;
}
```

Add `forkAction?: ForkActionRequest` to `MrSlopResponseEnvelope`.

- [ ] **Step 1: Write fork-envelope tests**

Cover:

```ts
it('parses a valid fork request', () => {
  expect(parseMrSlopEnvelope(JSON.stringify({
    text: 'I can split this timeline.',
    forkAction: {
      type: 'fork-specimen',
      suggestedName: 'METRIC CHILD',
      reason: 'Preserve this state and let another branch diverge.',
    },
  })).forkAction).toEqual({
    type: 'fork-specimen',
    suggestedName: 'METRIC CHILD',
    reason: 'Preserve this state and let another branch diverge.',
  });
});

it('drops malformed fork metadata while preserving text', () => {
  expect(parseMrSlopEnvelope(JSON.stringify({
    text: 'still talking',
    forkAction: { type: 'fork-specimen', reason: 7 },
  }))).toEqual({ text: 'still talking' });
});

it('includes fork semantics in the ordinary one-call response contract', async () => {
  const fetchMock = vi.fn(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    expect(body.systemInstruction).toContain('forkAction');
    expect(body.systemInstruction).toContain('parent remains unchanged');
    expect(body.systemInstruction).toContain('fresh conversation');
    return new Response(JSON.stringify({ text: '{"text":"ok"}' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  await sendMrSlopMessage({ history: [], userMessage: 'fork this thing', systemInstruction: 'SYSTEM' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
```

Also assert `MR_SLOP_BASE_SHELL` contains natural fork language and never calls it a GitHub fork.

- [ ] **Step 2: Run fork-envelope tests and verify RED**

Run:

```bash
npm test -- tests/forkEnvelope.test.ts
```

Expected: fail because `forkAction` is not part of the envelope.

- [ ] **Step 3: Implement parser and prompt contract**

In `geminiService.ts`, add strict parser:

```ts
const parseForkAction = (value: unknown): ForkActionRequest | undefined => {
  if (!isRecord(value) || value.type !== 'fork-specimen' || typeof value.reason !== 'string') {
    return undefined;
  }
  if (value.suggestedName !== undefined && typeof value.suggestedName !== 'string') {
    return undefined;
  }
  return {
    type: 'fork-specimen',
    reason: value.reason,
    ...(typeof value.suggestedName === 'string' && value.suggestedName.trim()
      ? { suggestedName: value.suggestedName.trim().slice(0, 80) }
      : {}),
  };
};
```

Parse it into the existing envelope without invoking another model.

Add contract text:

```text
Optional forkAction:
{"type":"fork-specimen","suggestedName":"optional short child name","reason":"why branching now is useful"}

Fork rules:
- A fork is a new saved specimen inside the same Mr. Slop app, not a GitHub fork.
- The parent remains unchanged by the creation request.
- The child starts a fresh conversation and inherits only application-owned active state.
- Do not claim the fork exists until the application confirms persistence.
```

Update `MR_SLOP_BASE_SHELL` so phrases like "fork this thing", "split this specimen", and "make a copy and let it evolve separately" can request `forkAction`.

- [ ] **Step 4: Run focused tests and full gate**

Run:

```bash
npm test -- tests/forkEnvelope.test.ts tests/mutationEnvelope.test.ts
npm test
npm run lint
npm run build
```

Expected: all pass and existing mutation-envelope parsing remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add types.ts services/geminiService.ts prompts/mrSlopBase.ts tests/forkEnvelope.test.ts
git commit -m "feat: add conversational fork request envelope"
```

---

### Task 7: Wire atomic fork persistence and compact lineage/drift UI

**Files:**
- Modify: `App.tsx`
- Modify: `components/MrSlopTerminal.tsx`
- Create: `components/LineageStatus.tsx`
- Create: `components/ForkResultCard.tsx`
- Modify: `components/SpecimenSidebar.tsx`
- Modify: `components/ConversationUI.css`
- Create: `tests/forkUI.test.tsx`
- Modify: `tests/mrSlopTerminal.test.tsx`

**Interfaces:**
- Consumes: `forkSpecimen`, `nextForkName`, `calculateDrift`, envelope `forkAction`.
- `MrSlopTerminalProps` adds:

```ts
onForkSpecimen?: (suggestedName?: string) => Promise<Specimen>;
onOpenSpecimen?: (specimen: Specimen) => void;
specimenNames?: Record<string, string>;
```

- [ ] **Step 1: Write App/terminal fork UI tests**

In `tests/forkUI.test.tsx`, cover these behaviors, plus final baseline capture for building specimens:

```ts
it('shows blocking fork approval but does not persist before approval', async () => {
  modelSend.mockResolvedValue({
    text: 'Split here.',
    forkAction: { type: 'fork-specimen', reason: 'Test two futures.' },
  });
  const onForkSpecimen = vi.fn();
  render(<MrSlopTerminal specimen={root} onChange={vi.fn()} onForkSpecimen={onForkSpecimen} />);

  sendText('fork this thing');
  await screen.findByText(/this creates a fork/i);
  expect(onForkSpecimen).not.toHaveBeenCalled();
});

it('persists fork on approval and offers open child or stay parent', async () => {
  onForkSpecimen.mockResolvedValue(child);
  // trigger fork action and approve...
  expect(await screen.findByRole('button', { name: /open child/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /stay with parent/i })).toBeInTheDocument();
});

it('shows compact generation scar and drift status', () => {
  render(<LineageStatus specimen={childWithModerateDrift} specimenNames={names} />);
  expect(screen.getByRole('button', { name: /lineage status/i })).toHaveTextContent(
    'GEN 2 · 3 SCARS · DRIFT: MODERATE',
  );
});

it('does not change visible parent when fork persistence rejects', async () => {
  onForkSpecimen.mockRejectedValue(new Error('storage failed'));
  // approve fork...
  expect(screen.getByText(/fork could not be saved/i)).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ id: expect.not.stringMatching(root.id) }));
});

it('finalizes a building specimen baseline when its first genome is installed', async () => {
  const building = makeSpecimen(emptyGenome, 'NEW SPECIMEN', 'building');
  // choose BUILD THIS for an installed genome...
  const spawned = latestSpecimen(onChange);
  expect(spawned.phase).toBe('spawned');
  expect(spawned.birthBaseline.genome).toEqual(spawned.birthGenome);
  expect(calculateDrift(spawned).score).toBe(0);
});
```

Add an `App`-level test or mocked storage test proving `saveSpecimens(nextList)` is awaited before `specimensRef`, `specimens`, or `activeSpecimen` is updated for a fork.

- [ ] **Step 2: Run fork UI tests and verify RED**

Run:

```bash
npm test -- tests/forkUI.test.tsx tests/mrSlopTerminal.test.tsx
```

Expected: fail because fork callbacks/components do not exist.

- [ ] **Step 3: Add atomic collection-level fork persistence in `App.tsx`**

Add:

```ts
const persistFork = async (suggestedName?: string): Promise<Specimen> => {
  if (!activeSpecimen) throw new Error('NO_ACTIVE_SPECIMEN');

  const source = specimensRef.current.find(item => item.id === activeSpecimen.id);
  if (!source) throw new Error('PARENT_SPECIMEN_NOT_FOUND');

  const childName = suggestedName?.trim() ||
    nextForkName(source, specimensRef.current);
  const { parent, child } = forkSpecimen(source, childName);

  const nextList = [
    ...specimensRef.current.map(item => item.id === parent.id ? parent : item),
    child,
  ];

  await saveSpecimens(nextList);

  specimensRef.current = nextList;
  setSpecimens(nextList);
  setActiveSpecimen(parent);
  return child;
};
```

Do **not** use the existing `storeList` implementation for this operation because it mutates React/ref state before persistence completes.

Pass `persistFork`, `openSpecimen`, and a memoized `Record<id,name>` into `MrSlopTerminal`.

- [ ] **Step 4: Add fork approval and result flow to `MrSlopTerminal.tsx`**

Add state:

```ts
const [pendingForkAction, setPendingForkAction] = useState<ForkActionRequest | null>(null);
const [forkResult, setForkResult] = useState<Specimen | null>(null);
```

When an envelope contains `forkAction`, open existing blocking modal with:

- title: `THIS CREATES A FORK`
- reason: include model reason plus factual "parent remains unchanged; child starts a fresh conversation"
- one approval option: `CREATE CHILD`.

When `spawnBuildingSpecimen` installs the first real genome, update all three birth fields together:

```ts
const bornAt = Date.now();
const next: Specimen = {
  ...working,
  phase: 'spawned',
  birthGenome: snapshotGenome(genome),
  currentGenome: snapshotGenome(genome),
  birthBaseline: captureBirthBaseline(working, genome, 'native-v3', bornAt),
  lastModified: bornAt,
};
```

Do not recapture the baseline on later genome changes.

On fork approval:

```ts
try {
  const child = await onForkSpecimen?.(pendingForkAction.suggestedName);
  if (!child) throw new Error('FORK_CALLBACK_MISSING');
  setForkResult(child);
  setPendingForkAction(null);
  setActiveDecision(null);
} catch {
  setStructuralError('The fork could not be saved. The parent is unchanged; you can retry.');
}
```

Do not create a parent checkpoint for forking.

- [ ] **Step 5: Implement compact status components**

`LineageStatus.tsx` calls `calculateDrift(specimen)`.

Collapsed button text:

```tsx
GEN {specimen.lineage.generation} · {specimen.scars.length} SCARS · DRIFT: {report.band}
```

Expanded panel shows:

- parent name or "ROOT",
- root name,
- generation,
- report explanation,
- experienced scar count,
- inherited scar count,
- active inherited trait/infection counts.

Do not render full scar prompts because scars do not have behavioral prompts.

`ForkResultCard.tsx` renders:

```tsx
<button onClick={onOpenChild}>OPEN CHILD</button>
<button onClick={onStay}>STAY WITH PARENT</button>
```

`OPEN CHILD` calls `onOpenSpecimen(child)`; `STAY WITH PARENT` only dismisses the card.

- [ ] **Step 6: Add sidebar lineage hint**

In `SpecimenSidebar.tsx`, add a small secondary line using deterministic drift:

```tsx
<small>
  GEN {specimen.lineage.generation} · {calculateDrift(specimen).band} DRIFT
</small>
```

Keep the existing phase/mode/parts line.

- [ ] **Step 7: Add restrained CSS**

Add compact classes only:

- `.lineage-status`
- `.lineage-status-toggle`
- `.lineage-status-panel`
- `.fork-result-card`
- `.fork-result-actions`

Use existing semantic colors; no new dashboard layout.

- [ ] **Step 8: Run UI tests and full gate**

Run:

```bash
npm test -- tests/forkUI.test.tsx tests/mrSlopTerminal.test.tsx
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add App.tsx components/MrSlopTerminal.tsx components/LineageStatus.tsx components/ForkResultCard.tsx components/SpecimenSidebar.tsx components/ConversationUI.css tests/forkUI.test.tsx tests/mrSlopTerminal.test.tsx
git commit -m "feat: add fork approval and lineage drift UI"
```

---

### Task 8: End-to-end Round 2B acceptance, persistence, and documentation

**Files:**
- Create: `tests/round2bAcceptance.test.tsx`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-18-mr-slop-round-2b-fork-scars-drift.md` only if execution discovers a factual plan correction that must be recorded.

**Interfaces:**
- Exercises public product behavior across schema migration, mutation/scars, fork persistence, divergence, reload, and drift.

- [ ] **Step 1: Write one end-to-end acceptance test**

Use mocked LocalForage like Round 2A acceptance and exercise:

1. create/migrate parent,
2. give parent one active trait and one two-turn infection,
3. let infection expire and verify experienced scar,
4. request and approve fork,
5. persist parent+child,
6. verify child has fresh chat, no artifacts/checkpoints, child-local active trait IDs, inherited scars, zero drift,
7. open child,
8. mutate child with a lasting trait or genome change,
9. verify child drift rises while parent drift/state does not change,
10. save/reload all specimens,
11. verify lineage, scars, baseline, and drift remain stable.

Core assertions:

```ts
expect(parentAfterFork.id).toBe(parentBeforeFork.id);
expect(child.lineage.parentSpecimenId).toBe(parentAfterFork.id);
expect(child.birthBaseline.source).toBe('fork-v3');
expect(calculateDrift(child).score).toBe(0);
expect(child.messages).toHaveLength(1);
expect(child.artifacts).toEqual([]);
expect(child.checkpoints).toEqual([]);

const divergedChild = acquireTrait(child, childOnlyProposal, 'explicit');
expect(calculateDrift(divergedChild).score).toBeGreaterThan(0);
expect(calculateDrift(parentAfterFork).score).toBe(parentDriftBeforeChildChange);

await saveSpecimens([parentAfterFork, divergedChild]);
const reloaded = await loadSpecimens();
expect(reloaded.find(s => s.id === divergedChild.id)?.lineage.parentSpecimenId)
  .toBe(parentAfterFork.id);
```

- [ ] **Step 2: Run acceptance test and fix only integration defects**

Run:

```bash
npm test -- tests/round2bAcceptance.test.tsx
```

If RED, diagnose the exact failed invariant before changing code. Do not loosen the test to fit implementation behavior unless the spec itself is wrong.

Expected final result: PASS.

- [ ] **Step 3: Update README with factual Round 2B behavior**

Document:

- in-app fork versus GitHub fork,
- active-state inheritance boundary,
- fresh child conversation,
- scars as history not prompt behavior,
- lifetime drift dimensions and bands,
- schema v3 migration while storage key remains `mrslop_specimens_v1`,
- one-call chat/no hidden drift analysis,
- explicit deferred breeding/family-tree scope.

Do not describe deferred features as implemented.

- [ ] **Step 4: Run final acceptance gate**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests, TypeScript/lint gate, and production build pass.

Also inspect npm install/audit output but do not run a forced breaking dependency upgrade as part of Round 2B.

- [ ] **Step 5: Inspect changed-file scope**

Verify the PR only contains:

- schema/lineage/scar/drift types and engines,
- response-envelope fork support,
- compact fork/lineage UI,
- tests,
- README/spec/plan docs.

Reject unrelated refactors and any accidental Gemini key/browser transport changes.

- [ ] **Step 6: Commit final acceptance/docs**

```bash
git add tests/round2bAcceptance.test.tsx README.md
git commit -m "test: lock Round 2B lineage acceptance"
```

- [ ] **Step 7: Merge only after green CI**

Open/update the Round 2B PR, wait for GitHub Actions, inspect failing job logs if any, repair test-first, and merge into `main` only after:

- tests green,
- lint/typecheck gate green,
- production build green,
- PR diff inspected,
- no server-side Gemini/AI Studio Secrets regression.

After merge, report the merge SHA and tell the user to pull `main`.
