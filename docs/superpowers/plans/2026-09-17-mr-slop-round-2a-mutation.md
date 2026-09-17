# Mr. Slop Round 2A — Stateful Mutation Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reversible, software-owned temporary infections, acquired traits, fossilized accidents, and specimen life-history tracking without changing the cost discipline or corrupting existing Round 1 specimens.

**Architecture:** Round 2A adds a mutation state layer beside the genome rather than rewriting the genome for every experiment. The runtime prompt becomes stable shell + stored genome/kernel + active acquired traits + active infections + specimen summary. Existing schema-v1 specimens migrate locally to schema v2 with empty mutation collections; FUSE kernels remain persisted and are not recompiled merely because a trait/infection is active.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 3, Testing Library, localforage, existing Express/Gemini server transport.

**Spec:** `docs/superpowers/specs/2026-09-17-mr-slop-round-2a-mutation-design.md`

## Global Constraints

- Birth genome remains an immutable historical snapshot.
- Runtime behavior is `CURRENT GENOME + ACTIVE ACQUIRED TRAITS + ACTIVE INFECTIONS`.
- Failed or aborted turns do not decrement infection duration.
- A successful accepted model reply decrements each active turn-limited infection exactly once.
- Temporary infections never force a FUSE recompile.
- Acquiring, retiring, restoring, promoting, or fossilizing a persistent trait uses checkpoint-first blocking approval.
- Candidate/generated mutations remain distinguishable from pinned AI SLOP library components.
- Normal conversation remains one model call per turn.
- Mutation/life-history state is owned by software, not described as hidden model internals.
- Existing Round 1 saved specimens must migrate without data loss.
- No breeding, drift scoring, lineage UI, Petri Dish, Semantic Manifold, or SRE/TOPOS implementation in this round.

---

## File Structure

Round 2A should use focused files rather than continuing to grow `MrSlopTerminal.tsx` and `specimenStore.ts` indefinitely.

- `types.ts` — persistent mutation/life-history/checkpoint types and response-envelope payload shapes.
- `lib/mutations.ts` — pure mutation state transitions and runtime-layer formatting.
- `lib/kernel.ts` — prompt-layer assembly only; consumes already-normalized mutation state.
- `services/specimenStore.ts` — schema migration, cloning, persistence, checkpoint creation/restoration.
- `services/geminiService.ts` — validate structured mutation proposals/actions from Gemini.
- `prompts/mrSlopBase.ts` — teach Mr. Slop how to propose mutations naturally without claiming they were applied.
- `components/MutationCard.tsx` — compact non-blocking mutation proposal choices.
- `components/MutationStatus.tsx` — minimal active-state readout, not a dashboard.
- `components/MrSlopTerminal.tsx` — orchestration only: model call, successful-turn accounting, cards/modals, applying approved operations.
- `tests/mutationMigration.test.ts` — v1 → v2 migration and persistence.
- `tests/mutations.test.ts` — pure mutation transitions, expiry, promotion, checkpoint restore.
- `tests/mutationKernel.test.ts` — runtime prompt layering for STACK and FUSE.
- `tests/mutationEnvelope.test.ts` — structured response parsing/validation.
- `tests/mutationUI.test.tsx` — proposal/apply/expiry/persistent approval behavior.

---

### Task 1: Schema v2, Migration, and Full-State Checkpoints

**Files:**
- Modify: `types.ts`
- Modify: `services/specimenStore.ts`
- Create: `tests/mutationMigration.test.ts`
- Modify: `tests/specimenStore.test.ts`

**Interfaces:**
- Produces `Infection`, `AcquiredTrait`, `LifeHistoryEvent`, `MutationProposal`, and schema-v2 `Specimen`.
- Produces `migrateSpecimen(value: unknown): Specimen | null`.
- Produces `checkpointSpecimen(specimen, reason)` snapshots containing genome + mutation state.
- Produces `restoreCheckpoint(specimen, checkpointId): Specimen`.
- Later tasks must treat `birthGenome` as historical data and never mutate it.

- [ ] **Step 1: Write failing migration tests**

Add tests proving a schema-v1 specimen loads as schema v2 with existing messages/artifacts/genomes intact and new collections initialized.

```ts
it('migrates a Round 1 specimen into mutation-capable schema v2', async () => {
  const old = makeLegacyV1Fixture();
  getItem.mockResolvedValue([old]);

  const [migrated] = await loadSpecimens();

  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.birthGenome).toEqual(old.birthGenome);
  expect(migrated.messages).toEqual(old.messages);
  expect(migrated.infections).toEqual([]);
  expect(migrated.acquiredTraits).toEqual([]);
  expect(migrated.lifeHistory).toEqual([]);
});
```

Also test that malformed objects are ignored rather than partially migrated.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
npm test -- tests/mutationMigration.test.ts tests/specimenStore.test.ts
```

Expected: failures because schema v2 fields and migration do not exist yet.

- [ ] **Step 3: Extend persistent types**

Use these shapes as the contract for later tasks:

```ts
export type InfectionStatus = 'active' | 'expired' | 'removed' | 'promoted';
export type InfectionDurationMode = 'turns' | 'indefinite';
export type MutationSourceType = 'user' | 'mr-slop' | 'artifact' | 'conversation' | 'mutation-proposal';

export interface MutationProvenance {
  specimenId: string;
  genomeId: string;
  sourceType: MutationSourceType;
  sourceMessageIds: string[];
  sourceArtifactIds: string[];
}

export interface Infection {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: InfectionStatus;
  durationMode: InfectionDurationMode;
  durationTurns?: number;
  remainingTurns?: number;
  provenance: MutationProvenance;
  createdAt: number;
  endedAt?: number;
  endReason?: string;
}

export type TraitStatus = 'active' | 'retired';
export type TraitOriginType = 'explicit' | 'promoted-infection' | 'fossilized-accident' | 'mr-slop-proposal';

export interface AcquiredTrait {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: TraitStatus;
  originType: TraitOriginType;
  provenance: MutationProvenance;
  createdAt: number;
  retiredAt?: number;
}

export type LifeHistoryEventType =
  | 'specimen-born'
  | 'genome-mutated'
  | 'infection-started'
  | 'infection-expired'
  | 'infection-removed'
  | 'infection-promoted'
  | 'trait-acquired'
  | 'trait-retired'
  | 'accident-fossilized'
  | 'checkpoint-restored';

export interface LifeHistoryEvent {
  id: string;
  type: LifeHistoryEventType;
  summary: string;
  mutationId?: string;
  checkpointId?: string;
  messageIds: string[];
  artifactIds: string[];
  createdAt: number;
}
```

Change `Specimen` to `schemaVersion: 2` and add:

```ts
infections: Infection[];
lifeHistory: LifeHistoryEvent[];
```

Extend `Checkpoint` so it contains complete reversible structural state:

```ts
export interface Checkpoint {
  id: string;
  reason: string;
  genome: Genome;
  acquiredTraits: AcquiredTrait[];
  infections: Infection[];
  createdAt: number;
}
```

- [ ] **Step 4: Implement explicit migration and cloning**

`loadSpecimens()` must accept valid v2 specimens and valid legacy v1 specimens. Convert v1 to v2 without touching old Ghost storage.

```ts
export const migrateSpecimen = (value: unknown): Specimen | null => {
  if (isValidV2Specimen(value)) return cloneSpecimenForStorage(value);
  if (!isValidLegacyV1Specimen(value)) return null;

  return {
    ...value,
    schemaVersion: 2,
    infections: [],
    acquiredTraits: (value.acquiredTraits ?? []).map(migrateLegacyTrait),
    lifeHistory: [],
    checkpoints: value.checkpoints.map(cp => ({
      ...cp,
      acquiredTraits: [],
      infections: [],
    })),
  };
};
```

Update `makeSpecimen()` to initialize v2 fields and append a `specimen-born` life-history event.

- [ ] **Step 5: Upgrade checkpoints and add restore**

`checkpointSpecimen()` snapshots current genome, acquired traits, and infections. `restoreCheckpoint()` must restore those fields, preserve messages/artifacts/history, and append `checkpoint-restored`.

```ts
export const restoreCheckpoint = (specimen: Specimen, checkpointId: string): Specimen => {
  const checkpoint = specimen.checkpoints.find(item => item.id === checkpointId);
  if (!checkpoint) throw new Error('CHECKPOINT_NOT_FOUND');

  return {
    ...specimen,
    currentGenome: cloneGenomeSnapshot(checkpoint.genome),
    acquiredTraits: cloneTraits(checkpoint.acquiredTraits),
    infections: cloneInfections(checkpoint.infections),
    lifeHistory: [...specimen.lifeHistory, makeHistoryEvent('checkpoint-restored', ...)],
    lastModified: Date.now(),
  };
};
```

- [ ] **Step 6: Run focused + full tests**

```bash
npm test -- tests/mutationMigration.test.ts tests/specimenStore.test.ts
npm test
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 7: Commit and merge this job**

Commit message:

```text
feat: add mutation-capable specimen schema
```

This job is independently useful: existing specimens become safely mutation-ready even before mutations are exposed in UI.

---

### Task 2: Pure Mutation Engine and Successful-Turn Accounting

**Files:**
- Create: `lib/mutations.ts`
- Create: `tests/mutations.test.ts`
- Modify: `services/specimenStore.ts` only if a shared clone helper is needed

**Interfaces:**
- Consumes schema-v2 mutation types from Task 1.
- Produces:
  - `startInfection(specimen, proposal, duration): Specimen`
  - `removeInfection(specimen, infectionId, reason?): Specimen`
  - `advanceSuccessfulTurn(specimen): Specimen`
  - `acquireTrait(specimen, proposal, originType): Specimen`
  - `retireTrait(specimen, traitId): Specimen`
  - `promoteInfection(specimen, infectionId): Specimen`
  - `fossilizeAccident(specimen, proposal): Specimen`
  - `activeInfections(specimen): Infection[]`
  - `activeTraits(specimen): AcquiredTrait[]`

- [ ] **Step 1: Write failing transition tests**

Cover at minimum:

```ts
it('expires a 1-turn infection after one successful accepted reply', () => {
  const infected = startInfection(specimen, proposal, { mode: 'turns', turns: 1 });
  const advanced = advanceSuccessfulTurn(infected);
  expect(advanced.infections[0].status).toBe('expired');
  expect(advanced.infections[0].remainingTurns).toBe(0);
  expect(advanced.lifeHistory.at(-1)?.type).toBe('infection-expired');
});

it('does not mutate the birth genome while acquiring a trait', () => {
  const birth = structuredClone(specimen.birthGenome);
  const next = acquireTrait(specimen, proposal, 'explicit');
  expect(next.birthGenome).toEqual(birth);
  expect(next.acquiredTraits).toHaveLength(1);
});

it('promotes an infection without deleting its historical record', () => {
  const next = promoteInfection(infected, infected.infections[0].id);
  expect(next.infections[0].status).toBe('promoted');
  expect(next.acquiredTraits[0].originType).toBe('promoted-infection');
});
```

Also cover indefinite infections, manual removal, retirement, fossilization provenance, and multiple infections decrementing once each.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm test -- tests/mutations.test.ts
```

- [ ] **Step 3: Implement immutable transition helpers**

All helpers must return new objects; do not mutate the passed specimen or canonical library components.

A proposal shape used by the engine:

```ts
export interface MutationProposal {
  id: string;
  kind: 'infection' | 'trait' | 'fossilized-accident';
  name: string;
  description: string;
  prompt: string;
  reason: string;
  recommendedTurns?: number;
  sourceMessageIds: string[];
  sourceArtifactIds: string[];
  sourceType: MutationSourceType;
}
```

- [ ] **Step 4: Implement successful-turn accounting as one pure operation**

`advanceSuccessfulTurn()` is the only helper that automatically decrements durations. It must append expiry events only for infections that cross to zero on that call.

- [ ] **Step 5: Run full verification**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 6: Commit and merge this job**

Commit message:

```text
feat: add specimen mutation state engine
```

---

### Task 3: Runtime Prompt Layers for Traits and Infections

**Files:**
- Modify: `lib/mutations.ts`
- Modify: `lib/kernel.ts`
- Create: `tests/mutationKernel.test.ts`
- Modify: `tests/kernel.test.ts`

**Interfaces:**
- Produces `compileMutationRuntimeLayer(traits, infections): string`.
- Extends `AssembleSystemInstructionArgs` with `acquiredTraits` and `infections`.
- Existing callers may pass empty arrays during migration of call sites.

- [ ] **Step 1: Write failing kernel tests**

Required assertions:

```ts
it('layers active traits and infections after a STACK genome', () => {
  const result = assembleSystemInstruction({
    phase: 'spawned',
    catalogIndex: '',
    genome: stackGenome,
    acquiredTraits: [trait],
    infections: [infection],
  });

  expect(result.indexOf('ACTIVE SPECIMEN KERNEL')).toBeLessThan(result.indexOf('ACTIVE ACQUIRED TRAITS'));
  expect(result.indexOf('ACTIVE ACQUIRED TRAITS')).toBeLessThan(result.indexOf('ACTIVE TEMPORARY INFECTIONS'));
});

it('does not alter or recompile the persisted FUSE kernel', () => {
  const before = fuseGenome.compiledKernel;
  const result = assembleSystemInstruction({ ... });
  expect(fuseGenome.compiledKernel).toBe(before);
  expect(result).toContain(before!);
  expect(result).toContain(infection.prompt);
});
```

Retired traits and expired/removed/promoted infections must not enter the runtime layer.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm test -- tests/mutationKernel.test.ts tests/kernel.test.ts
```

- [ ] **Step 3: Implement deterministic runtime formatting**

Example output contract:

```text
ACTIVE ACQUIRED TRAITS
--- TRAIT <id> :: <name> ---
<prompt>
--- END TRAIT <id> ---

ACTIVE TEMPORARY INFECTIONS
--- INFECTION <id> :: <name> :: 3 TURNS REMAINING ---
<prompt>
--- END INFECTION <id> ---
```

No mutation prompt is written into `Genome.compiledKernel` or component objects.

- [ ] **Step 4: Update `assembleSystemInstruction()`**

Layer order for spawned specimens must be:

1. `MR_SLOP_BASE_SHELL`
2. `KERNEL_PROTOCOL`
3. `ACTIVE SPECIMEN KERNEL`
4. active acquired traits
5. active infections
6. current specimen state

Builder phase remains unchanged.

- [ ] **Step 5: Run full verification**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 6: Commit and merge this job**

Commit message:

```text
feat: layer mutations into specimen runtime
```

---

### Task 4: Structured Mutation Proposals and Natural-Language Control Contract

**Files:**
- Modify: `types.ts`
- Modify: `services/geminiService.ts`
- Modify: `prompts/mrSlopBase.ts`
- Create: `tests/mutationEnvelope.test.ts`

**Interfaces:**
- Extends `MrSlopResponseEnvelope` with optional `mutationProposal` and `mutationAction`.
- Produces strict parsing that ignores malformed mutation payloads while preserving `text`.
- Does not directly mutate specimen state.

Use these response shapes:

```ts
export interface MutationActionRequest {
  type: 'start-infection' | 'promote-infection' | 'remove-infection' | 'acquire-trait' | 'retire-trait' | 'fossilize-accident' | 'restore-checkpoint';
  targetId?: string;
  proposal?: MutationProposal;
  durationMode?: InfectionDurationMode;
  durationTurns?: number;
}

export interface MrSlopResponseEnvelope {
  text: string;
  uiEvent?: ChoiceCardEvent | StructuralDecisionEvent;
  proposedGenome?: ...;
  mutationProposal?: MutationProposal;
  mutationAction?: MutationActionRequest;
}
```

- [ ] **Step 1: Write failing parser tests**

Cover valid infection proposal, valid fossilization proposal with source message IDs, valid remove/restore actions, and malformed payload rejection.

```ts
it('parses a bounded temporary infection proposal', () => {
  const result = parseMrSlopEnvelope(JSON.stringify({
    text: 'I have a small infection for you.',
    mutationProposal: {
      id: 'mut-1',
      kind: 'infection',
      name: 'Metric Vertigo',
      description: 'Change distance rules temporarily.',
      prompt: 'Treat musical distance as non-Euclidean.',
      reason: 'Your current genome keeps converging too quickly.',
      recommendedTurns: 5,
      sourceMessageIds: ['m1'],
      sourceArtifactIds: [],
      sourceType: 'mr-slop'
    }
  }));
  expect(result.mutationProposal?.recommendedTurns).toBe(5);
});
```

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm test -- tests/mutationEnvelope.test.ts
```

- [ ] **Step 3: Extend the response-envelope contract sent to Gemini**

Document optional mutation proposal/action JSON in `RESPONSE_ENVELOPE_CONTRACT`.

The prompt must explicitly say:

- proposals are suggestions, not applied state;
- persistent mutation actions require application/user approval;
- `fuck with yourself` should usually yield 2–3 operationally distinct candidates, preferably through a choice card plus mutation payloads rather than prose-only adjectives;
- `try that temporarily` should propose an infection duration;
- `keep that shit` should summarize the behavior that would be preserved and cite recent message/artifact IDs when supplied in context;
- `undo that shit` should identify the likely reversible target and request a restore/remove action rather than claiming it happened.

- [ ] **Step 4: Update `MR_SLOP_BASE_SHELL`**

Add mutation interaction rules without bloating ordinary replies. Preserve conversation-first behavior.

- [ ] **Step 5: Run full verification**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 6: Commit and merge this job**

Commit message:

```text
feat: add conversational mutation proposal contract
```

---

### Task 5: Mutation UI, Approval Flow, Expiry, and Undo Wiring

**Files:**
- Create: `components/MutationCard.tsx`
- Create: `components/MutationStatus.tsx`
- Modify: `components/ConversationUI.css`
- Modify: `components/MrSlopTerminal.tsx`
- Create: `tests/mutationUI.test.tsx`
- Modify: `tests/mrSlopTerminal.test.tsx`

**Interfaces:**
- Consumes mutation engine from Task 2 and response payloads from Task 4.
- Non-persistent infections may be started from an inline mutation card after the user chooses duration.
- Persistent operations are converted into the existing blocking `StructuralDecisionModal` flow.
- Successful model replies call `advanceSuccessfulTurn()` exactly once after the reply is accepted.

- [ ] **Step 1: Write failing UI tests**

Cover these user-visible behaviors:

```ts
it('starts a proposed temporary infection without changing birthGenome', async () => {
  modelMocks.send.mockResolvedValue({ text: 'Try this.', mutationProposal: infectionProposal });
  renderTerminal(specimen);
  await send('fuck with yourself');
  fireEvent.click(await screen.findByRole('button', { name: /try for 5 turns/i }));
  const next = latestSpecimen();
  expect(next.infections.some(item => item.status === 'active')).toBe(true);
  expect(next.birthGenome).toEqual(specimen.birthGenome);
});

it('does not decrement infection on failed model turn', async () => {
  modelMocks.send.mockRejectedValue(new Error('boom'));
  renderTerminal(specimenWithThreeTurnInfection);
  await send('hello');
  expect(latestSpecimen().infections[0].remainingTurns).toBe(3);
});

it('decrements once after a successful accepted reply', async () => {
  modelMocks.send.mockResolvedValue({ text: 'done' });
  renderTerminal(specimenWithThreeTurnInfection);
  await send('hello');
  expect(latestSpecimen().infections[0].remainingTurns).toBe(2);
});

it('routes fossilization through blocking structural approval', async () => {
  modelMocks.send.mockResolvedValue({ text: 'That behavior is worth keeping.', mutationProposal: fossilProposal });
  renderTerminal(specimen);
  await send('keep that shit');
  expect(await screen.findByText(/this changes the specimen/i)).toBeInTheDocument();
  expect(latestSpecimen().acquiredTraits).toHaveLength(0);
});
```

Also test promotion, manual infection removal, trait retirement, restore checkpoint, and ambiguous undo producing choices rather than silent action.

- [ ] **Step 2: Run UI tests and confirm RED**

```bash
npm test -- tests/mutationUI.test.tsx tests/mrSlopTerminal.test.tsx
```

- [ ] **Step 3: Add compact `MutationCard`**

For an infection proposal show at most:

- mutation name
- one-sentence behavior
- why now
- `TRY FOR N TURNS`
- `KEEP ON UNTIL I REMOVE IT`
- `NOPE`

For persistent trait/fossilization proposals, the card button should open the existing structural modal rather than applying state.

- [ ] **Step 4: Add minimal `MutationStatus`**

Do not create a dashboard. Use a compact header/readout only when mutation state exists, e.g.:

```text
2 INFECTIONS · 1 TRAIT
```

Tapping/clicking may reveal names and remaining turns in a small disclosure, but mutation state must remain secondary to conversation.

- [ ] **Step 5: Wire runtime state into model calls**

`assembleSystemInstruction()` receives `working.acquiredTraits` and `working.infections`.

`specimenStateSummary()` should include compact factual mutation state, not duplicate full prompts.

- [ ] **Step 6: Wire successful-turn accounting at the acceptance boundary**

In `processEnvelope()`:

1. create model message;
2. commit the accepted model message;
3. run `advanceSuccessfulTurn()` on that specimen;
4. persist resulting expirations/history;
5. then expose any new mutation proposal/action UI.

Do not call `advanceSuccessfulTurn()` from `finally`, error handlers, or request start.

- [ ] **Step 7: Route persistent mutation actions through structural approval**

Before acquiring/retiring/promoting/fossilizing/restoring:

```ts
const checkpointed = checkpointSpecimen(working, reason);
commit(checkpointed);
// wait for explicit modal approval before applying persistent mutation
```

If the modal is dismissed, the mutation is not applied. If creating a pre-approval checkpoint would clutter history, create the checkpoint inside the approve handler immediately before applying the mutation; do not create it merely because the proposal appeared.

- [ ] **Step 8: Implement context-sensitive undo**

When a validated `mutationAction` requests `remove-infection` or `restore-checkpoint`, resolve the specified target. If the model did not identify a unique target, render a concise choice card from actual software state rather than guessing.

- [ ] **Step 9: Run full verification**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 10: Commit and merge this job**

Commit message:

```text
feat: make specimen mutations conversational and reversible
```

---

### Task 6: Provenance Polish, Life-History Acceptance Pass, and Documentation

**Files:**
- Modify: `components/MrSlopTerminal.tsx`
- Modify: `components/MutationStatus.tsx`
- Modify: `README.md`
- Create: `tests/mutationAcceptance.test.tsx`

**Interfaces:**
- No new core interfaces unless an acceptance test exposes a missing invariant.
- Produces a complete Round 2A user flow ready for the next round.

- [ ] **Step 1: Write acceptance tests for the full life cycle**

One test should exercise:

1. specimen exists from Round 1/migration;
2. temporary infection starts for 2 turns;
3. successful reply decrements to 1;
4. failed turn leaves 1;
5. next successful reply expires it;
6. expired infection remains in specimen history;
7. user fossilizes a later behavior through approval;
8. acquired trait survives save/reload;
9. restore checkpoint reverses the lasting trait but preserves conversation/artifacts/life-history record.

- [ ] **Step 2: Verify provenance and history are factual**

Check that fossilized/promoted traits preserve source message/artifact IDs and the genome ID active at acquisition. Ensure no UI copy says Mr. Slop discovered hidden neural machinery.

- [ ] **Step 3: Update README**

Document:

- temporary infection semantics;
- acquired traits/fossilized accidents;
- successful-turn expiry rule;
- checkpoint/undo behavior;
- runtime layering and FUSE cost discipline;
- schema-v2 local migration;
- Round 2A non-goals.

- [ ] **Step 4: Run the final Round 2A gate**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests green, TypeScript clean, production client/server build succeeds.

- [ ] **Step 5: Manual acceptance in AI Studio after merge**

Confirm on phone-sized preview and desktop:

- existing saved specimens still open;
- `fuck with yourself` can yield mutation ideas;
- a temporary infection visibly counts down only after successful replies;
- `keep that shit` never silently applies a lasting change;
- active mutation status is visible but does not dominate chat;
- reloading preserves traits/infections/history;
- normal chat remains responsive and does not trigger hidden extra model calls.

- [ ] **Step 6: Commit and merge this job**

Commit message:

```text
chore: finish Round 2A mutation lifecycle
```

---

## Self-Review

### Spec coverage

- Temporary infections: Tasks 1–3 and 5–6.
- Automatic expiry only on successful accepted turns: Tasks 2 and 5.
- Indefinite infection option: Tasks 1–2 and 5.
- Acquired traits: Tasks 1–3 and 5.
- Fossilized accidents with evidence/provenance: Tasks 2, 4–6.
- Checkpoint-first persistent changes and restore: Tasks 1 and 5.
- Conversation-first natural language: Tasks 4–5.
- `fuck with yourself`, `try that temporarily`, `keep that shit`, `undo that shit`: Task 4 prompt contract + Task 5 software actions.
- Life-history events: Tasks 1–2 and 6.
- FUSE no-recompile rule: Task 3.
- Existing specimen migration: Task 1.
- No breeding/SRE scope creep: Global constraints and all task boundaries.

### Placeholder scan

No TBD/TODO/"implement later" placeholders are part of the plan. Each task defines concrete files, interfaces, tests, commands, and merge boundaries.

### Type consistency

`MutationProposal`, `Infection`, `AcquiredTrait`, `LifeHistoryEvent`, `MutationActionRequest`, and the schema-v2 `Specimen` are defined before later tasks consume them. Persistent operations all use the same mutation engine and checkpoint contract rather than duplicating mutation logic in UI code.
