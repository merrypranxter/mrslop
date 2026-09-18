# Mr. Slop Round 2C Breeding Implementation Plan

> **Execution mode:** test-first, one job/PR at a time. Every job branches from the latest verified `main`, adds failing tests first, implements only the approved scope, passes focused tests + full test/lint/build gates, waits for CI, then merges before the next job begins.

**Goal:** Add deterministic two-parent breeding with schema-v4 lineage, role-preserving component crossover, explainable trait inheritance, rare controlled birth mutation, app-owned genetics receipts, stale-preview protection, idempotent atomic persistence, and compact breeding UI while preserving all Round 1 / 2A / 2B behavior.

**Spec:** `docs/superpowers/specs/2026-09-18-mr-slop-round-2c-breeding-design.md`

**Tech stack:** React 19, TypeScript, Vitest + Testing Library, LocalForage, existing Express/Vite + Gemini transport, GitHub Actions CI.

## Global constraints

- Two distinct persisted `spawned` specimens are required.
- Breeding uses each parent's current lived state.
- Breeding itself makes zero Gemini calls.
- The child is always born STACK.
- Parent FUSE compiled kernels and custom seed text never cross breeding.
- Active/inactive infections never cross breeding.
- Parent scars may only bias trait inheritance through explicit stored links and are not copied into bred children.
- Ordinary genome target is the unbiased average of enabled parental component counts.
- Breeding role for v1 is `GenomeComponent.kind`.
- Shared component weight = 2.0; unique component weight = 1.0.
- Trait probabilities = ordinary 35%, promoted 45%, fossilized 55%, shared 70%, direct scar support +15 points once.
- Hard cap = 3 inherited traits.
- Birth mutation = 12.5%, max one, 50/50 preferred branch before fallback.
- No model-authored mystery genes or hidden-state/weight claims.
- Same breeding-relevant parent state + same seed + same algorithm version reproduces the same genetic result.
- Parent selector order is neutral to genetic outcome.
- Parent behavior remains unchanged; only factual offspring history is appended after successful persistence.
- Preview must become stale when breeding-relevant parent state changes.
- One approved preview is idempotent and cannot accidentally create duplicate offspring.
- LocalForage key remains exactly `mrslop_specimens_v1`.
- Never read, migrate, or delete `ghost_sessions`.
- Ordinary chat remains one Gemini request per successful user turn by default.
- No compatibility scoring or automatic "best mate" ranking.

---

## Planned job sequence

### Job 1 — Schema v4, multi-parent lineage, inheritance sources, and receipt persistence

**Files**
- Modify: `types.ts`
- Modify: `services/specimenStore.ts`
- Modify: `lib/lineage.ts`
- Modify: `lib/drift.ts` only where lineage shape is consumed
- Create: `tests/round2cMigration.test.ts`
- Modify existing Round 2B migration/fork/drift tests as required

**Test-first scope**
- v3 root -> v4 root migration
- v3 fork -> v4 fork migration
- singular `inheritedFrom` -> inheritance source list of length 1
- no invented second parent/root
- messages/artifacts/checkpoints/genomes/mutations/scars/baseline/life history preserved
- storage key unchanged
- Round 2B fork behavior remains valid after new lineage shape
- v4 validation rejects malformed multi-parent lineage/receipt data

**Implementation**
- Add schema-v4 `LineageRecord` with:
  - `kind: 'root' | 'fork' | 'bred'`
  - `parentSpecimenIds: string[]`
  - `rootSpecimenIds: string[]`
  - `generation`
  - source/migration metadata
  - existing fork metadata
  - optional breeding metadata
- Add multi-source trait inheritance provenance.
- Add `TraitOriginType: 'inherited'`.
- Add persisted `GeneticsReceipt` / breeding birth metadata types.
- Extend `Specimen` to schemaVersion 4 and child-owned genetics receipt state.
- Add new life-history event types for breeding.
- Migrate existing v3 specimens conservatively.
- Preserve v1/v2 -> current migration chain.

**Gate**
```bash
npm test -- tests/round2cMigration.test.ts tests/round2bMigration.test.ts tests/lineageFork.test.ts tests/drift.test.ts
npm test
npm run lint
npm run build
```

---

### Job 2 — Deterministic genetics primitives

**Files**
- Create: `lib/geneticsRandom.ts`
- Create: `lib/breedingState.ts`
- Create: `tests/geneticsRandom.test.ts`
- Create: `tests/breedingState.test.ts`

**Test-first scope**
- 128-bit seed validation/generation representation
- stable deterministic uniform values by namespace
- namespace independence
- candidate-order independence
- canonical parent-order neutrality
- stable component and trait fingerprints
- breeding-state hash ignores messages/artifacts/offspring history
- breeding-state hash changes for component order, enabled set, active trait, qualifying scar support
- same state/seed/version reproduces same primitives

**Implementation**
- `GENETICS_ALGORITHM_VERSION = 'mrslop-breeding-v1'`
- deterministic hash-to-uniform helper
- canonical stable serialization
- parent canonicalization helper
- component functional fingerprint
- trait functional fingerprint
- breeding-relevant snapshot + hash
- seed/idempotency helper primitives

**Gate**
```bash
npm test -- tests/geneticsRandom.test.ts tests/breedingState.test.ts
npm test
npm run lint
npm run build
```

---

### Job 3 — Genome crossover engine

**Files**
- Create: `lib/genomeBreeding.ts`
- Create: `tests/genomeBreeding.test.ts`

**Test-first scope**
- unbiased integer/half-integer target size
- role quotas by `ComponentKind`
- fractional quota assignment
- role deficit redistribution
- shared candidate weight 2.0
- unique candidate weight 1.0
- weighted sampling without replacement
- same-ID divergent alleles mutually exclusive
- parental unique contribution balanced to <= 1 when legal
- deterministic repair swaps
- deterministic child STACK order from parental normalized positions
- disabled components excluded from ordinary crossover
- parent FUSE/custom seed ignored
- parent input objects remain immutable

**Implementation**
- Build canonical component candidate pool.
- Compute target size + role quotas.
- Use deterministic exponential-race weighted selection.
- Apply parent-balance repair.
- Compute deterministic child order.
- Produce structured genome-selection receipt section.
- Return plain STACK component selection only; no persistence yet.

**Gate**
```bash
npm test -- tests/genomeBreeding.test.ts
npm test
npm run lint
npm run build
```

---

### Job 4 — Trait inheritance and scar support engine

**Files**
- Create: `lib/traitBreeding.ts`
- Create: `tests/traitBreeding.test.ts`

**Test-first scope**
- active-only trait candidate pool
- infections excluded
- ordinary 35%
- promoted-infection 45%
- fossilized-accident 55%
- shared functional trait 70%
- direct scar support +15 once
- multiple supporting scars do not stack
- no name/prose-based scar guessing
- shared trait collapses to one candidate
- independent deterministic rolls
- hard cap three via `roll / probability`
- pass-but-displaced receipt state
- child lifecycle reset to `inherited`
- one-parent and two-parent inheritance source arrays
- inherited parental trait later breeds as ordinary unless child independently earns a stronger state
- source parents remain immutable

**Implementation**
- Candidate construction/fingerprint collapse.
- Explicit scar-link lookup.
- Probability calculation.
- Deterministic roll and cap.
- Child-local inherited trait construction helpers.
- Structured trait receipt section.

**Gate**
```bash
npm test -- tests/traitBreeding.test.ts tests/scars.test.ts tests/mutations.test.ts
npm test
npm run lint
npm run build
```

---

### Job 5 — Controlled birth mutation engine

**Files**
- Create: `lib/birthMutation.ts`
- Create: `tests/birthMutation.test.ts`

**Test-first scope**
- exact 12.5% trigger semantics
- one mutation maximum
- 50/50 preferred branch
- canonical component pool excludes every component identity present anywhere in either parent's current genome, enabled or disabled
- canonical component mutation is additive +1 only
- no FUSE/custom-seed mutation
- trait variation operates only on inherited traits
- registered deterministic mutator only
- no free-form mystery gene
- preferred-branch fallback
- both branches unavailable -> recorded no-op
- deterministic replay

**Implementation**
- Canonical component mutation selector.
- Small explicit trait-mutator registry.
- Mutation receipt section.
- Final child genetic state transformation.

**Gate**
```bash
npm test -- tests/birthMutation.test.ts
npm test
npm run lint
npm run build
```

---

### Job 6 — Pure breeding preview engine + genetics receipt + replay

**Files**
- Create: `lib/breeding.ts`
- Create: `lib/geneticsReceipt.ts`
- Create: `tests/breedingPreview.test.ts`
- Create: `tests/geneticsReceipt.test.ts`

**Test-first scope**
- validates two distinct spawned parents
- parent-order-neutral genetic result
- creates fresh seed or accepts explicit test seed
- combines Jobs 2–5 in the approved order
- child always STACK
- no compiled kernel/custom seed/infections/scars copied
- fresh child-local inherited trait IDs
- true two-parent lineage generation = max(parent generations)+1
- roots are sorted deduplicated union
- birth receipt contains all candidates/rolls/weights/repairs/mutation/final state
- receipt renderer explains facts without model call
- replay from receipt/seed/snapshots reproduces genetic result
- preview mutates neither parent
- bred child baseline evaluates to drift 0
- birth mutation and inherited traits are baseline state

**Implementation**
- `createBreedingPreview`
- child naming helper inputs but no persistence
- child birth event data
- genetics receipt renderer/replay verifier
- deterministic idempotency key

**Gate**
```bash
npm test -- tests/breedingPreview.test.ts tests/geneticsReceipt.test.ts tests/drift.test.ts
npm test
npm run lint
npm run build
```

---

### Job 7 — Atomic persistence, stale preview detection, and idempotency

**Files**
- Create: `lib/breedingPersistence.ts` or equivalent focused helper
- Modify: `services/specimenStore.ts` if shared clone/validation support is needed
- Modify: `App.tsx`
- Create: `tests/breedingPersistence.test.ts`

**Test-first scope**
- approval re-reads parent state
- breeding-relevant state change makes preview stale
- unrelated message/artifact/offspring-history changes do not make preview stale
- successful commit writes updated Parent A + Parent B + child in one specimen-list save
- parents' genomes/traits/infections/scars/messages/checkpoints/baselines unchanged
- only factual offspring events + lastModified bookkeeping change
- failed save exposes no committed child/parent event
- duplicate approved preview resolves existing child by idempotency key
- intentional new seed creates sibling
- reload preserves parent events/child/receipt

**Implementation**
- collection-level commit helper
- stale hash comparison
- idempotency lookup
- parent offspring event construction
- one `saveSpecimens` call before React state commit

**Gate**
```bash
npm test -- tests/breedingPersistence.test.ts
npm test
npm run lint
npm run build
```

---

### Job 8 — Breeding UI and conversation-first integration

**Files**
- Create: `components/BreedingPicker.tsx`
- Create: `components/BreedingPreviewCard.tsx`
- Create: `components/GeneticsReceiptView.tsx`
- Create/modify: post-birth result card as appropriate
- Modify: `components/MrSlopTerminal.tsx`
- Modify: `components/SpecimenSidebar.tsx` only if needed for factual selection context
- Modify: `components/ConversationUI.css`
- Modify: `App.tsx`
- Create: `tests/breedingUI.test.tsx`

**Test-first scope**
- selector lists valid spawned specimens only
- self-pair blocked
- no compatibility score/ranking
- factual parent contrast only
- preview before write
- button language includes **THIS CREATES OFFSPRING**
- cancel writes nothing
- approval commits exact preview
- stale preview shows recompute path
- receipt inspectable
- success shows **OPEN CHILD** / **STAY HERE**
- no Gemini call is made by picker/preview/approval path

**Implementation**
- compact breeding action surface
- human-selected parents
- preview/approve/cancel lifecycle
- stale/retry messaging
- result navigation

**Gate**
```bash
npm test -- tests/breedingUI.test.tsx
npm test
npm run lint
npm run build
```

---

### Job 9 — Lineage/drift display updates and factual comparison

**Files**
- Modify: `components/LineageStatus.tsx`
- Modify: `components/SpecimenSidebar.tsx`
- Modify: `lib/drift.ts` only as needed for v4 lineage access
- Create/modify: focused UI tests

**Test-first scope**
- bred child shows two parents/generation factually
- fork UI still shows one parent
- roots render without parent
- generation does not alter drift
- bred birth starts zero drift
- factual comparison contains overlap/count/origin facts only
- no "best", "better mate", compatibility percentage, or ranking field exists

**Gate**
```bash
npm test -- tests/drift.test.ts tests/lineageStatus.test.tsx
npm test
npm run lint
npm run build
```

---

### Job 10 — Full Round 2C acceptance, documentation, and regression hardening

**Files**
- Create: `tests/round2cAcceptance.test.tsx`
- Modify: `README.md`
- Modify any exact regression tests only where schema-v4 shape requires it

**Acceptance flow**
1. Load/migrate existing Round 2B specimens.
2. Give parents different lived traits/scars/infections/current genomes.
3. Open breeding UI.
4. Preview with fixed seed.
5. Verify receipt math.
6. Mutate one irrelevant chat field and confirm preview remains valid.
7. Approve.
8. Verify atomic parent/child persistence.
9. Verify child STACK, no infections/scars, inherited traits, receipt, two-parent lineage, drift 0.
10. Breed same pair again with a new seed and persist sibling.
11. Mutate child after birth and verify parent/sibling independence.
12. Persist/reload.
13. Verify receipt replay and lineage.
14. Verify FUSE parents breed without FUSE call.
15. Run entire regression suite.

**Final gate**
```bash
npm test
npm run lint
npm run build
```

Then wait for GitHub Actions on the final job PR. Merge only when all required checks are green.

---

## Branch / PR protocol

For each job:

1. Confirm `main` contains the previous merged job.
2. Create `round-2c-job-N-<short-name>` from current `main`.
3. Add failing tests first.
4. Commit the RED test state if useful for review.
5. Implement the minimum approved behavior.
6. Run focused test gate.
7. Run `npm test`, `npm run lint`, `npm run build`.
8. Push/update the job branch.
9. Open PR titled `Round 2C Job N: <name>`.
10. Inspect diff and CI.
11. Fix only job-scope failures.
12. Merge into `main` after CI is green.
13. Start the next job from the newly merged `main`.

No implementation job may silently redesign the approved genetics math. If the code exposes a genuine architectural contradiction, stop at that exact contradiction and resolve it explicitly before continuing.

## Final Round 2C completion gate

Round 2C is complete only when:

- all ten jobs are merged into `main`,
- final `main` passes the full test suite,
- TypeScript lint/typecheck passes,
- production build passes,
- GitHub Actions for the final merged state is green,
- README documents schema v4 and breeding behavior,
- no ordinary chat cost regression exists,
- no breeding path invokes Gemini or FUSE,
- all approved probabilities/invariants are covered by tests,
- schema-v3 specimens migrate safely,
- Round 2B fork/scar/drift behavior remains intact.
