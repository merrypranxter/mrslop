# Mr. Slop Round 2C Design: Breeding and Controlled Freak Genetics

Date: 2026-09-18

## Status

Conversational design approved. Written design self-reviewed and pending final user approval before implementation planning.

## 1. Purpose

Round 2C adds **two-parent breeding** to Mr. Slop.

The objective is not to simulate biological genetics literally. The objective is to create a deterministic, inspectable, application-owned inheritance system that lets two existing specimens produce a genuinely new descendant from their **current lived state**.

Breeding combines:

- current enabled genome components,
- active acquired traits,
- factual scar support,
- two-parent lineage,
- rare controlled birth mutation,
- and a complete deterministic GENETICS RECEIPT.

The system must remain technically honest. Breeding manipulates application-owned prompt/state records. It does not claim to recombine model weights, hidden states, embeddings, latent vectors, or neural parameters.

Round 2C should feel like genetics without becoming arbitrary magic.

## 2. Product boundary

Round 2C includes:

- selecting two existing spawned specimens as parents,
- previewing a deterministic offspring before persistence,
- role-preserving seeded component crossover,
- probabilistic trait inheritance,
- scar-supported inheritance bias,
- rare birth mutation,
- true two-parent lineage,
- schema v4 migration,
- parent offspring history,
- a persisted GENETICS RECEIPT,
- fresh child conversation/history,
- zero lifetime drift at birth,
- and atomic persistence of both parents plus child.

Round 2C does **not** include:

- automatic mate recommendation,
- "best mate" scoring,
- phenotype fitness ranking,
- Petri-dish tournaments,
- automatic population evolution,
- sexual/reproductive simulation beyond abstract inheritance mechanics,
- dominant/recessive gene modeling,
- meiosis/chromosome simulation,
- model-authored hidden genes,
- external controllers,
- Semantic Manifold/SRE/TOPOS integration,
- cloud sync,
- or Gemini calls for breeding.

## 3. Core breeding invariants

Round 2C is governed by these approved rules:

1. Breeding uses both parents' **current lived state**, not their original birth state.
2. Breeding has two true parents.
3. The breeding event stores a deterministic seed.
4. The same breeding-relevant parent state plus the same seed and algorithm version produces the same genetic result.
5. Breeding itself makes **zero Gemini calls**.
6. The child is always born in **STACK** mode.
7. FUSE remains a later explicit action.
8. Genome size targets the average enabled current genome size of the two parents.
9. Shared genome components receive higher inheritance weight.
10. Parent contribution should remain balanced when the available role structure permits it.
11. At most three active traits are inherited.
12. Promoted-infection traits and fossilized traits have higher inheritance probability.
13. Directly supporting scars add another inheritance boost.
14. Active temporary infections never cross the breeding boundary.
15. Parent scars influence inheritance but are never copied into the child as scar state.
16. The child starts a fresh conversation and fresh lifetime history.
17. The child starts at lifetime drift 0.
18. Parents remain behaviorally unchanged.
19. Parents receive only factual offspring-history records after successful persistence.
20. Every breeding result has an app-owned GENETICS RECEIPT.
21. Birth mutation has a deterministic 1-in-8 chance and a maximum of one mutation.
22. Mutation may add one canonical library component absent from both parents or mechanically vary one inherited trait.
23. No mutation may invent mystery genes, hidden-state explanations, or weight-level claims.
24. The same parent pair may breed repeatedly because new seeds may produce different children.
25. The application never ranks or recommends a "best" mate.

## 4. Parent eligibility

A breeding event requires:

- two persisted specimens,
- both specimens in phase \`spawned\`,
- two distinct specimen IDs,
- both specimens successfully validated under the current persisted schema.

A specimen may breed regardless of:

- generation,
- drift band,
- STACK/FUSE current mode,
- whether the other parent is an ancestor, descendant, sibling, cousin, fork relative, or unrelated specimen.

Round 2C does not enforce kinship restrictions.

A specimen may not breed with itself.

## 5. Breeding-relevant lived state

Breeding reads a frozen snapshot of each parent's state at preview time.

The breeding-relevant snapshot includes:

- specimen ID,
- lineage metadata needed for ancestry,
- current genome ID,
- all current genome components and their enabled state,
- component prompt/version/source snapshot data,
- active acquired traits,
- trait origin type,
- trait operational prompt,
- trait inheritance provenance,
- scars and their direct factual links to traits,
- and any structured fields required to reproduce the genetics calculation.

The snapshot excludes:

- messages,
- artifacts except IDs already contained in trait/scar provenance,
- checkpoints,
- retired traits,
- active or inactive temporary infection records,
- unrelated life-history events,
- prior offspring-history entries,
- timestamps that do not alter breeding behavior,
- UI state,
- drift display text,
- and other fields that do not affect inheritance.

Active temporary infections are excluded from breeding even though they are part of current runtime behavior.

## 6. Breeding-state hash

Each parent receives a deterministic **breeding-state hash** computed from a canonical serialization of the breeding-relevant snapshot.

The hash exists for:

- stale-preview detection,
- deterministic replay,
- idempotency,
- and receipt verification.

The canonical serialization must:

- use stable field ordering,
- sort unordered sets deterministically,
- preserve ordered fields where order affects behavior,
- exclude timestamps/IDs that do not affect breeding,
- include current component order because STACK order affects runtime prompt assembly,
- include trait/scar relationships used in inheritance math,
- and be versioned with the genetics algorithm.

The important determinism statement is therefore:

> Same two breeding-relevant parent states + same breeding seed + same genetics algorithm version = same genetic result.

Fresh persistence IDs and display timestamps are not part of the genetic result.

## 7. Breeding seed and deterministic random decisions

Every breeding preview receives one app-generated **128-bit seed**.

The seed is generated locally with cryptographically strong browser/runtime randomness. No model call is involved.

The seed is persisted in the receipt.

Round 2C must not use one fragile sequential PRNG stream whose later results shift when candidate ordering changes.

Instead, each random decision derives an independent deterministic uniform value from:

- genetics algorithm version,
- breeding seed,
- a stable decision namespace/key.

Examples of stable decision namespaces include:

- child genome size rounding,
- role quota allocation,
- component candidate selection,
- parental balance repair,
- per-trait inheritance roll,
- trait-cap tie resolution,
- birth-mutation trigger,
- birth-mutation branch,
- mutation target,
- mutation operator.

Adding an unrelated candidate in a future implementation should not silently perturb every other deterministic decision.

The initial algorithm identifier should be explicit, for example:

\`mrslop-breeding-v1\`

Historical receipts always retain the algorithm identifier that created them.

## 8. Parent-order neutrality

Parent A and Parent B are UI labels, not genetic dominance labels.

For genetics:

- parent IDs are canonicalized into a stable order before seed-key construction,
- swapping the same two parents in the selector while keeping the same seed and parent states must not alter the genetic result.

For display:

- the receipt may preserve which specimen the user selected as Parent A and Parent B,
- provenance still identifies the actual source parent for each inherited record.

## 9. Genome source boundary

Only **enabled components in each parent's current genome** enter ordinary crossover.

Disabled components are not inheritance candidates.

Parent assembly mode does not cross the breeding boundary.

If a parent is currently FUSE:

- its current component list is still used as genetic material,
- its compiled FUSE kernel is **not** inherited,
- the child does not trigger FUSE,
- the child is born STACK.

Parent \`customSeed\` text is not inherited through Round 2C breeding.

A custom seed is free-form behavioral text rather than a canonical component. Copying or blending it would bypass the controlled crossover and mutation rules.

## 10. Breeding role

For Round 2C v1, a component's breeding role is its persisted \`GenomeComponent.kind\`:

- mind,
- operator,
- regulator,
- seed,
- media,
- custom.

\`roleHints\` remain useful descriptive metadata but are not authoritative slot categories for genetics v1.

This gives the breeding engine one stable, explicit role per component and avoids ambiguous multi-role counting.

A later genetics algorithm version may use richer role assignment without changing historical receipts.

## 11. Shared component identity

Two parent components count as one **shared candidate** only when they are functionally identical snapshots.

At minimum the shared fingerprint must agree on:

- stable component ID,
- component kind,
- version/source snapshot identity,
- operational prompt content.

Display metadata such as local order does not prevent shared identity.

If both parents contain the same stable component ID but their stored functional snapshots differ, they are treated as **two alleles of one component identity**, not as a shared candidate.

Two divergent alleles with the same stable component ID are mutually exclusive in one child genome. The child may inherit at most one of them.

## 12. Target child genome size

Let:

- \`nA\` = number of enabled current genome components in Parent A,
- \`nB\` = number of enabled current genome components in Parent B.

The target mean is:

\`mu = (nA + nB) / 2\`

If the mean is an integer, target child size equals that integer.

If the mean ends in .5, the breeding seed makes a deterministic 50/50 choice between floor and ceiling.

This unbiased rounding prevents systematic genome inflation.

Examples:

- 4 + 6 -> target 5
- 5 + 5 -> target 5
- 5 + 6 -> target 5 or 6 depending on seed
- 2 + 7 -> target 4 or 5 depending on seed

The ordinary child genome must not exceed this target except for the explicit +1 canonical-component birth mutation described later.

## 13. Role-preserving quota calculation

Genome-size averaging is also applied by breeding role.

For each component kind:

1. Count enabled Parent A components of that kind.
2. Count enabled Parent B components of that kind.
3. Compute the role mean.
4. Lock integer portions.
5. Resolve fractional role slots deterministically using seed-derived tie breaking while maintaining the already-determined total child target size.

Example:

- mind: 2 and 2 -> quota 2
- operator: 2 and 1 -> quota 1.5
- regulator: 1 and 3 -> quota 2
- seed: 0 and 1 -> quota 0.5

The fractional slots are allocated so the final ordinary crossover count equals the target child size.

If a calculated role quota cannot be filled because there are not enough distinct eligible candidates in that role, the deficit is redistributed deterministically to roles with remaining eligible candidates.

The receipt must record any quota deficit and redistribution.

Role preservation is therefore the primary constraint, but exact target size wins when the parent candidate pool can support it.

## 14. Component inheritance weights

Within each role, ordinary crossover uses deterministic weighted sampling without replacement.

Initial weights:

- candidate present in only one parent: **1.0**
- functionally identical candidate present in both parents: **2.0**

A deterministic weighted lottery should use a mathematically valid sampling method such as an exponential-race key:

\`selectionKey = -ln(U) / weight\`

where \`U\` is the stable seed-derived uniform value for that candidate.

Lowest keys win.

The exact mathematical implementation may vary only if:

- weighted probability remains correct,
- sampling is deterministic,
- candidate ordering does not change the outcome,
- and the receipt exposes enough information to replay the decision.

## 15. Balanced parental contribution

After ordinary component selection, classify selected components as:

- A-only,
- B-only,
- shared.

Shared components are neutral because both parents contributed them.

The breeding engine should attempt to ensure:

\`abs(A-only count - B-only count) <= 1\`

If the initial weighted selection violates that balance, perform deterministic repair swaps.

A repair swap:

- removes a selected unique candidate from the overrepresented parent,
- adds an eligible unselected unique candidate from the underrepresented parent,
- stays inside the same breeding role whenever possible,
- preserves total genome size,
- never duplicates a stable component identity.

If same-role balance is impossible because of the available parent material, the engine preserves the closest valid result rather than breaking the role/genome invariants.

The receipt records:

- initial contribution counts,
- any repair swaps,
- final counts,
- and why exact balance was impossible if it could not be reached.

## 16. Child component ordering

STACK order is behaviorally meaningful and therefore cannot be random incidental array order.

The child ordering algorithm should preserve parental ordering information deterministically.

For each selected component:

- compute its normalized position in each parent in which it appears,
- use the mean normalized position for shared candidates,
- use the source parent's normalized position for unique candidates,
- sort by normalized position,
- use a seed-derived stable tie breaker for equal positions.

After sorting, assign child-local integer \`order\` values from 0 upward.

This makes the child's STACK prompt order a deterministic recombination of parental order rather than canonical-library order or object iteration order.

The order calculation belongs in the receipt.

## 17. Trait candidate pool

Only active acquired traits are considered.

The candidate pool includes active traits with origin types such as:

- explicit,
- mr-slop-proposal,
- promoted-infection,
- fossilized-accident,
- inherited from earlier breeding/fork lineage where still active.

Active temporary infections never become trait candidates merely because they are active.

Retired traits never become candidates.

Functionally identical active traits in both parents collapse into one shared trait candidate.

## 18. Trait functional identity

Trait identity must be derived from behaviorally relevant content rather than record IDs or names.

The v1 trait functional fingerprint should be a stable digest of canonicalized operational behavior, centered on the persisted trait prompt plus any explicit structured behavioral modifiers.

Exclude:

- trait ID,
- source specimen ID,
- source message/artifact IDs,
- created/retired timestamps,
- display name,
- descriptive provenance text,
- parent lineage labels.

Two traits with different names but the same operational behavior may therefore become one shared candidate.

The fingerprinting algorithm is versioned as part of the genetics algorithm.

## 19. Trait inheritance probabilities

Initial probabilities are fixed as follows:

- ordinary active trait: **35%**
- promoted-infection trait: **45%**
- fossilized-accident trait: **55%**
- functionally identical trait present in both parents: **70%**
- direct scar support: **+15 percentage points**

Scar support is additive once.

Multiple directly supporting scars do not stack the bonus.

Maximum v1 inheritance probability is therefore 85%.

Examples:

- ordinary + scar -> 50%
- promoted-infection + scar -> 60%
- fossilized-accident + scar -> 70%
- shared + scar -> 85%

A shared candidate uses the shared 70% base instead of adding the two parent-specific base probabilities together.

## 20. Direct scar support

A scar directly supports a trait only when stored factual relationships connect the scar to that trait.

Round 2C should use structured IDs rather than semantic guessing.

Direct support includes a scar whose \`relatedMutationIds\` contains the trait ID.

For promoted-infection ancestry, a promotion scar that records both the source infection ID and resulting trait ID directly supports that resulting trait.

For fossilization, the fossilization scar directly supports the created fossilized trait through its recorded trait ID.

Inherited scars from an earlier fork may support the source event historically, but the breeding engine must follow explicit inheritance/source references and may not infer support from matching names or prose.

The receipt records which scar IDs supplied the +15-point bonus.

## 21. Trait inheritance roll

Each trait candidate receives an independent deterministic uniform roll.

The candidate inherits when:

\`roll < inheritanceProbability\`

Zero inherited traits is valid.

One, two, or three inherited traits are valid.

The system does not guarantee one trait from each parent.

This preserves the advertised probabilities instead of secretly overriding them with a parental quota.

## 22. Hard cap of three inherited traits

If zero to three trait candidates pass their rolls, all passing traits inherit.

If more than three candidates pass, apply the hard cap.

For each passing candidate compute:

\`inheritanceStrength = roll / inheritanceProbability\`

Lower values are stronger.

Keep the three candidates with the lowest normalized strength.

Use a stable seed-derived tie breaker only for exact numerical ties.

The receipt must list candidates that:

- failed their probability roll,
- passed and inherited,
- passed but were displaced by the three-trait cap.

## 23. Inherited trait lifecycle reset

A child inherits **behavior**, not the parent's lived lifecycle status.

If Parent A's trait is promoted-infection or fossilized-accident, the higher probability applies during this breeding event because that state belongs to the parent's lived history.

If the child inherits the trait:

- the child receives a new child-local trait ID,
- the trait is active,
- its Round 2C origin becomes **inherited**,
- the inherited behavioral prompt is preserved,
- source parent/trait references are preserved,
- source parental origin type is recorded as ancestry metadata,
- but the child is not born claiming it personally promoted an infection or fossilized an accident.

An inherited trait therefore breeds as an ordinary active trait in the child's future breeding events unless a later independent event gives the child its own qualifying state.

This prevents exponential inheritance privilege across generations.

## 24. Shared trait provenance

A shared trait inherited from both parents becomes one child-local active trait.

Its inheritance provenance records both parent sources.

The child does not receive duplicate copies of the same functional trait.

The receipt identifies:

- both parent trait IDs,
- both source parent IDs,
- shared-candidate status,
- scar support from either/both parents,
- the 70% shared base probability,
- the final probability,
- and the inheritance roll.

## 25. Scars at the breeding boundary

Parent scars may influence inheritance probability only through direct structured trait support.

Parent scars themselves are **not copied into the child**.

The bred child starts with no inherited copy of either parent's scar collection.

Round 2C also does not need to create a generic "bred-birth scar." Two-parent birth is represented by:

- lineage,
- child birth history,
- parent offspring history,
- and the GENETICS RECEIPT.

This keeps scars factual and event-specific rather than turning ancestry itself into scar clutter.

## 26. Temporary infections at the breeding boundary

No infection record crosses the breeding boundary.

This includes:

- active turn-limited infections,
- active indefinite infections,
- expired infections,
- removed infections,
- promoted infection records.

A promoted infection may matter only because it already created an active acquired trait.

The child therefore begins with:

- no active infections,
- no inactive infection history,
- no inherited infection duration.

## 27. Birth mutation trigger

After ordinary component crossover and trait inheritance are fully resolved, evaluate birth mutation.

Mutation triggers when the stable mutation roll is below:

**0.125**

This is a deterministic 1-in-8 chance.

At most one birth mutation may occur.

Mutation is not allowed to cascade into additional mutations.

## 28. Birth mutation branch

When mutation triggers, a second deterministic roll chooses the preferred branch:

- lower half -> canonical component mutation
- upper half -> inherited trait variation

This is a 50/50 branch split before fallback.

If the selected branch has no valid candidate, attempt the other branch.

If neither branch has a valid candidate:

- mutation remains recorded as triggered,
- mutation outcome is a no-op,
- no other rule is violated to force a mutation.

The receipt explicitly records trigger, preferred branch, fallback, and final outcome.

## 29. Canonical component mutation

The canonical-component mutation pool comes only from the pinned canonical component library.

A mutation candidate must:

- be valid/enabled in the canonical library,
- be absent from both parents' complete current genome component identities, including disabled components,
- be absent from the child after ordinary crossover,
- not duplicate a stable component identity already present in the child.

One valid candidate is chosen deterministically.

The mutation is **additive**.

It does not replace an inherited component.

Therefore a child with ordinary target size 6 may be born with 7 components if and only if that extra component is the one allowed canonical birth mutation.

The receipt records that the component came from birth mutation, not either parent.

No FUSE compilation occurs.

## 30. Deterministic trait variation mutation

A trait-variation mutation may operate only on a trait the child actually inherited.

It does not create a fourth inherited trait.

It replaces one inherited trait with one deterministic variant of that same inherited behavior.

Trait variation must be performed by an explicit application-owned mutator registry.

A valid trait mutator must:

- be deterministic,
- be versioned,
- operate only on supported structured fields or explicit deterministic prompt wrappers,
- preserve traceable ancestry to the inherited trait,
- never call a model,
- never invent hidden mechanisms,
- never fabricate a new free-form "gene."

If no registered mutator can safely operate on any inherited trait, this branch has no valid candidate and must fall back to canonical component mutation.

The receipt stores:

- source inherited trait,
- mutator ID/version,
- before/after structured values or prompt wrapper,
- and final child trait fingerprint.

## 31. Child genome construction

After crossover and possible mutation, construct one new child genome.

The child's birth/current genome is:

- mode: \`stack\`
- components: selected inherited components plus optional one-component birth mutation
- all child components enabled
- deterministic child component order
- fresh child genome ID
- no inherited parent compiled kernel
- no compiledAt/compilerVersion
- no inherited custom seed

The child's \`birthGenome\` and initial \`currentGenome\` represent the same birth state.

They must be stored as independent clones where mutation safety requires it, while preserving the same genetic content.

## 32. Child state at birth

A bred child receives:

- new specimen ID,
- new child genome ID,
- STACK birth/current genome,
- zero to three inherited active traits,
- zero infections,
- zero copied parent scars,
- zero checkpoints,
- zero artifacts,
- fresh conversation/history,
- two-parent lineage,
- persisted GENETICS RECEIPT,
- new birth baseline,
- lifetime drift exactly 0.

The child does not copy:

- either parent's transcript,
- either parent's artifacts,
- either parent's checkpoints,
- retired traits,
- infections,
- scars,
- full life history,
- compiled FUSE kernels,
- custom seed text.

## 33. Fresh child conversation

The child starts with a compact system-generated factual birth note.

The note may state:

- both parent names,
- generation,
- inherited component count,
- inherited trait count,
- whether a birth mutation occurred.

It must not narrate hidden biological lore or claim model-level genetic mechanisms.

Example shape:

> Bred from SLOP A and SLOP B at generation 4. Born STACK with 6 genome components and 2 inherited traits. One canonical birth mutation occurred. This specimen starts a fresh conversation from its own birth state.

The child transcript contains no parent messages.

## 34. True two-parent lineage: schema v4

Round 2C requires schema version 4.

The v3 singular lineage fields are insufficient for a two-parent child.

Schema v4 should use a lineage structure centered on:

- \`kind\`: root | fork | bred
- \`parentSpecimenIds\`: 0, 1, or 2 IDs
- \`rootSpecimenIds\`: deduplicated stable list of all known roots
- \`generation\`
- birth mechanism metadata
- source/migration marker
- optional fork metadata
- optional breeding metadata

Generation rules:

- root = 0
- fork child = parent generation + 1
- bred child = max(Parent A generation, Parent B generation) + 1

For a bred child:

- \`parentSpecimenIds\` contains both parent IDs in canonical stable order,
- \`rootSpecimenIds\` is the sorted deduplicated union of both parents' root sets.

Lineage remains a graph. The application does not recursively duplicate full ancestor trees into each specimen.

## 35. Schema v3 to v4 migration

The LocalForage storage key remains:

\`mrslop_specimens_v1\`

Schema v3 specimens migrate locally to schema v4.

Migration must preserve:

- specimen IDs,
- names/phases,
- messages,
- artifacts,
- checkpoints,
- birth/current genomes,
- traits,
- infections,
- scars,
- birth baselines,
- life history,
- drift behavior,
- fork ancestry.

Migration converts existing lineage:

For a v3 root:

- kind -> root
- parentSpecimenIds -> []
- rootSpecimenIds -> [existing rootSpecimenId]
- generation preserved

For a v3 fork:

- kind -> fork
- parentSpecimenIds -> [existing parentSpecimenId]
- rootSpecimenIds -> [existing rootSpecimenId]
- generation/fork metadata preserved

No ancestry is invented.

Existing v1/v2 migration may continue to flow through the established migration chain so old valid specimens still reach current v4 safely.

The app must never read, migrate, or delete \`ghost_sessions\`.

## 36. Trait inheritance schema changes

Schema v4 must support true inheritance provenance for bred traits.

The current singular fork-oriented \`inheritedFrom\` representation is not sufficient for a shared two-parent trait.

The v4 trait representation should support:

- origin type \`inherited\`,
- zero/one/many inheritance source references,
- each source reference identifying source specimen and source trait record,
- source parental trait origin type for historical explanation,
- inheritance timestamp,
- optional supporting scar IDs used during that breeding event,
- optional birth-variation metadata.

Migrated existing fork-inherited traits become an inheritance source list of length 1.

The runtime prompt still uses the child's active trait prompt, not ancestry metadata.

## 37. Life-history event additions

Round 2C extends life history with factual event types such as:

- \`specimen-offspring-bred\`
- \`specimen-born-from-breeding\`

Parent offspring event records should include stable references to:

- child specimen ID,
- co-parent specimen ID,
- genetics receipt ID,
- breeding seed or seed fingerprint,
- breeding timestamp.

Child birth event records both parent IDs and receipt ID.

No parent event is committed before the complete breeding transaction succeeds.

## 38. GENETICS RECEIPT

Every breeding preview creates a complete application-owned structured GENETICS RECEIPT.

The approved preview and the persisted child use the **same receipt payload** except for persistence-owned fields that are created only at commit time.

The receipt is not model-generated prose.

Minimum receipt sections:

### Identity

- receipt ID
- genetics algorithm version
- breeding seed
- selected Parent A ID/name
- selected Parent B ID/name
- canonical parent ID order
- parent breeding-state hashes
- preview creation time
- final persistence time when approved

### Genome target

- Parent A enabled component count
- Parent B enabled component count
- raw mean
- rounding decision
- final ordinary target size
- role counts for each parent
- role means
- role quotas
- quota redistribution if any

### Component candidates

For every candidate:

- stable component identity/fingerprint
- role/kind
- source parent(s)
- shared/unique/divergent-allele status
- weight
- deterministic uniform/key
- selected/rejected result
- parental-balance repair participation
- final child order metric

### Traits

For every trait candidate:

- trait fingerprint
- source parent trait IDs
- source parental origin type(s)
- shared status
- base probability
- supporting scar IDs
- scar bonus
- final probability
- deterministic roll
- pass/fail
- cap strength
- final inherited/displaced result

### Mutation

- mutation trigger roll
- threshold
- triggered yes/no
- preferred branch
- candidate pool
- fallback if any
- selected mutation
- no-op reason if neither branch is possible

### Final birth state

- final child component identities/order
- final child trait fingerprints/source ancestry
- child mode STACK
- child birth mutation summary
- expected birth drift 0

## 39. Receipt persistence

The bred child should own its birth genetics receipt as structured persisted state.

Parent life-history records reference the child specimen ID and receipt ID rather than duplicating the full receipt.

This keeps the authoritative receipt with the offspring whose birth it explains while still allowing either parent to point to the event.

A receipt must remain readable even if later child behavior changes.

Checkpoint restore does not erase or rewrite the birth receipt.

## 40. Friendly receipt UI

The application may render human-readable explanations from receipt data.

Examples:

> Fossilized trait inherited from MABEL. Base chance 55%; direct scar support raised it to 70%. Roll 0.418 -> inherited.

> MEMORY ECOLOGY was functionally identical in both parents, so it entered the shared candidate pool at 2.0 crossover weight.

> Trait passed its inheritance roll but was excluded by the three-trait birth cap.

These explanations must be deterministic renderings of stored receipt facts.

No model call is needed to explain genetics.

## 41. Preview flow

Breeding UI flow:

1. Choose Parent A.
2. Choose Parent B.
3. App creates a fresh breeding seed.
4. App snapshots both breeding-relevant states.
5. App computes hashes.
6. App computes complete child genetics and receipt in memory.
7. User sees **THIS CREATES OFFSPRING** preview.
8. No specimen is persisted yet.
9. User approves or cancels.

The preview should show enough factual information to understand:

- expected child genome size,
- inherited components,
- inherited traits,
- mutation outcome if any,
- parent contribution,
- and lineage.

Cancel leaves both parents unchanged.

## 42. Stale-preview protection

Approval must re-read the current saved parents.

Compare their current breeding-state hashes with the hashes stored in the preview.

If both hashes match:

- persist exactly the previewed genetic result.

If either hash differs:

- do not silently breed from changed state,
- do not partially persist,
- mark the preview stale,
- recompute a new preview from current state with a new seed unless the UI explicitly supports replaying the same seed.

Changes that should invalidate the preview include:

- enabled genome component changes,
- component order changes,
- relevant component snapshot changes,
- active trait changes,
- qualifying trait origin changes,
- relevant scar-support changes.

Unrelated chat messages, artifact saves, prior offspring-history appends, and other excluded fields do not invalidate the breeding preview.

## 43. Atomic persistence

Approval is one collection-level atomic operation from the user's point of view.

The app constructs in memory:

1. updated Parent A with factual offspring event,
2. updated Parent B with factual offspring event,
3. complete child with receipt and birth event.

Then it performs one saved-specimen collection write.

Only after that write succeeds may the UI treat the breeding event as committed.

If construction or persistence fails:

- neither parent receives offspring history,
- no child is exposed as persisted,
- no false success message appears,
- retry remains possible.

If persistence succeeds but navigation fails, the two parent events and child already exist consistently in saved state.

## 44. Idempotency

Each preview receives an idempotency key derived from:

- genetics algorithm version,
- canonical parent IDs,
- both parent breeding-state hashes,
- breeding seed.

Submitting the same approved preview twice must not create accidental duplicate offspring.

If the same idempotency key is already committed, the app resolves to the existing child.

This protects against:

- double taps,
- duplicate event delivery,
- retry after uncertain UI completion.

Intentionally breeding the same pair again creates a new seed and therefore a new idempotency key and potentially a different child.

## 45. Repeated breeding

The same pair may breed any number of times.

Each new breeding attempt receives a new seed.

Because crossover, trait rolls, cap resolution, and mutation are seed-driven, siblings may differ in:

- genome size when the parental mean is half-integer,
- inherited unique components,
- shared/unique contribution pattern,
- inherited traits,
- birth mutation,
- final component order tie breaks.

No hidden diversity call or model sampling is required.

## 46. Child naming

The child may receive a deterministic default display name without affecting genetics.

A simple format is acceptable:

\`<Parent A> × <Parent B> / CHILD N\`

where N is derived from existing successfully persisted offspring of that pair.

User rename behavior may remain separate.

Names are never used as genetic identity.

Specimen IDs and receipt references are authoritative.

## 47. Parent behavior after breeding

Breeding must not alter either parent's:

- current genome,
- birth genome,
- traits,
- infections,
- scars,
- checkpoints,
- artifacts,
- messages,
- birth baseline,
- drift,
- runtime behavior.

The only parent change after successful persistence is factual offspring history and last-modified bookkeeping required by storage.

Breeding therefore does not require a structural checkpoint for either parent.

## 48. Drift semantics

A bred child captures its own birth baseline **after**:

- child-local component/genome identity is finalized,
- inherited child-local trait IDs are created,
- optional birth mutation is applied,
- lineage and receipt are finalized.

Therefore the child begins with:

**lifetime drift = 0**

Inherited traits and the birth mutation are birth state, not post-birth drift.

Future changes are measured normally against that complete birth baseline.

Generation remains lineage context and does not add drift.

## 49. Mate comparison UI

Round 2C may help the user compare possible parents factually.

Allowed factual contrast includes:

- generation,
- drift band/score,
- enabled component count,
- component overlap count,
- component kinds represented,
- active trait counts/origin classes,
- shared trait count,
- common roots or known ancestry.

The app must not:

- assign compatibility scores,
- rank mates,
- label one parent "best",
- recommend an optimal mate,
- or automatically select a breeding partner.

The human chooses both parents.

## 50. Cost discipline

Breeding itself requires zero Gemini calls.

Specifically, Round 2C must not call Gemini to:

- choose parents,
- calculate crossover,
- identify shared components,
- decide trait inheritance,
- infer scar support,
- choose mutations,
- write the receipt,
- name the child by default,
- explain receipt math,
- calculate lineage,
- calculate birth drift,
- persist offspring history.

FUSE is not called at birth.

Ordinary conversation remains one Gemini request per successful user turn by default.

## 51. Technical honesty

Round 2C terminology is application metaphor backed by explicit state.

Allowed claims:

- this trait was inherited,
- this scar raised the app-owned inheritance probability,
- this component came from Parent A,
- this shared component had higher crossover weight,
- this seed deterministically selected this result,
- this child mutated by receiving a canonical library component.

Disallowed claims:

- a neural weight mutated,
- the model's hidden state was genetically altered,
- latent DNA was recombined,
- the child inherited an actual internal neural pathway,
- scars changed Gemini's model weights.

The app owns the genetics simulation.

## 52. Data-integrity invariants

1. Two distinct spawned parents are required.
2. Breeding uses current lived state.
3. Active temporary infections never cross the breeding boundary.
4. Parent scars never copy into bred children.
5. Parent scars only affect trait probability through explicit stored support.
6. Ordinary child genome target is the unbiased average of enabled parent genome sizes.
7. Ordinary crossover is role/kind preserving as far as the available candidate pool permits.
8. Shared components have weight 2.0; unique components have weight 1.0.
9. Unique parental contribution is balanced to within one when a legal repair exists.
10. Child component order is deterministic.
11. Trait probabilities are 35/45/55/70 plus at most one +15 scar bonus.
12. At most three inherited active traits survive the cap.
13. Child inherited traits reset to inherited lifecycle origin.
14. Shared traits become one child-local trait with two-parent provenance.
15. Birth mutation triggers at 12.5%.
16. Birth mutation count is at most one.
17. Mutation branch preference is 50/50 before fallback.
18. Canonical mutation may add at most one component absent from both parent current genomes.
19. Trait variation may only use registered deterministic application mutators.
20. Bred child is born STACK.
21. Parent FUSE kernels never cross breeding.
22. Parent custom seed text never crosses breeding.
23. Child conversation/history is fresh.
24. Child artifacts/checkpoints/infections/scars begin empty.
25. Child lifetime drift begins at zero.
26. Parents remain behaviorally unchanged.
27. Parent offspring history is written only after successful atomic persistence.
28. Every persisted bred child owns one genetics receipt.
29. Receipt decisions can be replayed from parent snapshots/hashes, seed, and algorithm version.
30. Same approved preview cannot accidentally persist twice.
31. Same pair may intentionally breed again with a new seed.
32. No Gemini call is required for breeding.
33. No mate ranking is produced.

## 53. Acceptance scenario: ordinary two-parent birth

Parent A:

- 6 enabled components,
- 2 active ordinary traits,
- 1 promoted trait with promotion scar,
- 1 active infection,
- 3 unrelated scars.

Parent B:

- 4 enabled components,
- 1 ordinary trait,
- 1 fossilized trait with fossilization scar,
- 1 active indefinite infection,
- 2 scars.

User selects both and previews breeding.

Expected:

- target ordinary child genome size = 5,
- component selection uses role quotas and shared weighting,
- active infections are ignored,
- eligible traits receive correct 35/45/55/shared probabilities,
- direct supporting scars add +15 only to linked traits,
- maximum 3 traits inherit,
- parent scars are not copied,
- mutation roll occurs after inheritance,
- child preview is complete without persistence,
- approving creates a fresh STACK child,
- child starts at drift 0,
- parents only gain factual offspring events.

## 54. Acceptance scenario: shared trait with scar

Both parents have functionally identical active trait behavior.

Parent A's copy is ordinary.

Parent B's copy is fossilized and has a directly linked fossilization scar.

Expected candidate:

- one shared trait candidate,
- base probability 70% because the trait is shared,
- +15 because at least one direct supporting scar exists,
- final probability 85%,
- one deterministic roll,
- if inherited, child receives one active inherited trait,
- child provenance references both parent traits,
- child does not receive Parent B's fossilized lifecycle state or scar.

## 55. Acceptance scenario: more than three traits pass

Five candidates pass their independent rolls.

Expected:

- compute roll/probability normalized strength for all five,
- keep the three lowest values,
- two are recorded as pass-but-displaced,
- receipt explains the cap outcome,
- child owns exactly three inherited active traits.

## 56. Acceptance scenario: mutation component branch

Mutation trigger fires.

Preferred branch is canonical component.

There are valid canonical components absent from both parents.

Expected:

- one deterministic candidate is chosen,
- component is appended to child birth genome,
- ordinary target size may be exceeded by exactly one,
- receipt marks mutation source,
- no parent is credited with the component,
- child remains STACK,
- no FUSE call occurs.

## 57. Acceptance scenario: mutation fallback

Mutation trigger fires.

Preferred branch is trait variation.

No inherited trait has a registered valid mutator.

Canonical component candidates exist.

Expected:

- trait branch recorded as unavailable,
- canonical branch used as fallback,
- exactly one canonical mutation occurs,
- no free-form trait mutation is invented.

If neither branch has a valid candidate:

- mutationTriggered remains true,
- mutationOutcome records no-valid-candidate,
- child birth remains otherwise unchanged.

## 58. Acceptance scenario: stale preview

User previews Child X.

Before approval, Parent A gains a new active acquired trait.

Expected:

- Parent A breeding-state hash changes,
- approval does not persist the stale child,
- both parents remain unchanged by the failed approval,
- app requests/recomputes a fresh preview from current state.

If Parent A only adds an unrelated chat message:

- breeding-state hash does not change,
- original preview remains valid.

## 59. Acceptance scenario: idempotent approval

User approves one preview and the persistence handler is triggered twice.

Expected:

- first submission commits child and both parent offspring events,
- second submission resolves via the same idempotency key,
- no duplicate child is created,
- no duplicate parent offspring history is appended.

## 60. Acceptance scenario: repeated siblings

Same two unchanged parents breed again intentionally.

A new seed is generated.

Expected:

- new idempotency key,
- a second child may legally have different inherited components/traits/mutation,
- both children preserve the same two parent IDs,
- parent behavior remains unchanged across both births.

## 61. Acceptance scenario: FUSE parents

Parent A and/or Parent B currently use FUSE.

Expected:

- breeding reads enabled current component snapshots,
- compiled kernels are not inherited,
- child is STACK,
- child has no compiled kernel,
- breeding uses zero Gemini calls.

## 62. Acceptance scenario: schema v3 migration

Existing Round 2B specimen loads after Round 2C upgrade.

Expected:

- schema becomes v4,
- messages/artifacts/checkpoints/genomes/traits/infections/scars/baseline/life history are preserved,
- old root/fork lineage becomes the equivalent v4 multi-parent-capable structure,
- fork-inherited trait provenance remains factual,
- no ancestors or second parents are invented,
- drift behavior remains stable.

## 63. UI acceptance

The breeding UI should remain compact and conversation-first.

Required interaction:

- choose Parent A,
- choose Parent B,
- optional factual contrast summary,
- **THIS CREATES OFFSPRING** preview,
- approval/cancel,
- successful persistence,
- **OPEN CHILD**
- **STAY HERE**

The genetics receipt may be collapsible but must remain inspectable.

No family-tree dashboard is required.

No best-mate score appears.

## 64. Testing strategy

Implementation must be test-first.

Required groups:

1. **Schema v4 migration**
   - v3 root -> v4
   - v3 fork -> v4
   - old fork inheritance -> multi-source-capable trait schema
   - all existing Round 2A/2B state preserved
   - old storage key unchanged

2. **Deterministic genetics primitives**
   - stable seed namespace
   - parent-order neutrality
   - stable breeding-state hash
   - unbiased half-integer target-size rounding
   - candidate-order independence

3. **Genome crossover**
   - role/kind quotas
   - shared weight 2.0
   - unique weight 1.0
   - exact target size where candidate pool permits
   - quota redistribution
   - parental balance repair
   - same-ID divergent allele exclusion
   - deterministic child order

4. **Trait genetics**
   - 35/45/55/70 probabilities
   - +15 direct scar bonus
   - no stacked scar bonus
   - active-only traits
   - no infections
   - shared trait collapse
   - three-trait cap
   - lifecycle reset to inherited
   - two-parent provenance

5. **Birth mutation**
   - exact 12.5% threshold semantics
   - 50/50 branch selection
   - canonical component novelty
   - additive +1 only
   - trait-mutator registry
   - branch fallback
   - no-valid-candidate no-op
   - maximum one mutation

6. **Receipt**
   - all candidate decisions recorded
   - replay reproduces genetic result
   - receipt rendering matches structured facts
   - historical receipt remains immutable after child changes

7. **Persistence**
   - stale preview rejected
   - atomic two-parent + child save
   - parent behavioral immutability
   - idempotent double approval
   - reload preserves child/receipt/parent history

8. **Drift**
   - bred child starts at 0
   - birth mutation included in baseline
   - inherited traits included in baseline
   - later changes count normally

9. **UI**
   - only valid spawned specimens selectable
   - self-pair prevented
   - no automatic mate ranking
   - preview before write
   - cancel writes nothing
   - stale preview path
   - OPEN CHILD / STAY HERE

10. **Regression**
   - Round 1 build routes still work
   - Round 2A mutation lifecycle still works
   - Round 2B fork/scar/drift still works
   - ordinary chat remains one Gemini call by default
   - FUSE still only occurs through explicit FUSE behavior

## 65. Suggested implementation decomposition

A later implementation plan should likely separate Round 2C into jobs roughly along these boundaries:

1. schema v4 lineage/inheritance/receipt types and v3 migration,
2. deterministic seed/hash/random-decision primitives,
3. genome crossover and component-order engine,
4. trait inheritance/scar-support engine,
5. birth-mutation engine,
6. breeding preview + genetics receipt rendering,
7. atomic persistence/idempotency/stale-preview integration,
8. conversation/UI breeding flow,
9. drift/lineage display updates,
10. full regression/acceptance/CI cleanup.

Exact job boundaries should be finalized only after this written design is approved.

## 66. Explicitly deferred beyond Round 2C

- automatic compatibility or mate scoring,
- dominant/recessive genetics,
- chromosome simulation,
- populations/ecology,
- tournament fitness,
- automatic selective breeding,
- full family-tree visualization,
- ancestral drift visualization,
- artifact inheritance,
- infection inheritance,
- scar inheritance in bred children,
- model-generated mutation genes,
- model-weight/latent manipulation claims,
- Semantic Manifold/SRE/TOPOS,
- external state controllers,
- cloud sync.

## 67. Completion criteria

Round 2C is complete when:

- two distinct spawned specimens can breed,
- breeding uses their current lived state,
- the same parent states/seed/algorithm reproduce the same genetic result,
- child genome crossover preserves role structure and avoids runaway union growth,
- shared components receive higher crossover weight,
- parent component contribution is balanced when structurally possible,
- trait inheritance uses the approved probabilities and cap,
- direct scar support is factual and explainable,
- infections/scars do not cross the breeding boundary,
- inherited traits reset lifecycle state while retaining ancestry,
- birth mutation is deterministic, rare, controlled, and limited to one,
- child is always born STACK,
- breeding triggers no Gemini/FUSE calls,
- true two-parent lineage persists in schema v4,
- child starts with fresh history and lifetime drift 0,
- parents remain behaviorally unchanged,
- parent offspring history is committed only with successful child persistence,
- every bred child has an inspectable GENETICS RECEIPT,
- stale previews cannot create genetically mismatched children,
- duplicate approval cannot create duplicate offspring,
- repeated breeding with new seeds can create different siblings,
- schema-v3 specimens migrate safely,
- all Round 1/2A/2B behavior remains intact,
- tests, lint, build, and CI pass before implementation work is merged.
