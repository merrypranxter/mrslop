# Mr. Slop Round 2A — Stateful Mutation Layer

Date: 2026-09-17
Status: Design approved in conversation; written spec awaiting final review before implementation planning.

## Purpose

Round 2A gives a Mr. Slop specimen a real software-owned life history after birth. The goal is not to simulate hidden model internals. The goal is to make temporary experiments, learned behaviors, preserved accidents, and reversions explicit, inspectable, reversible specimen state.

Round 1 established a stable Mr. Slop shell, mutable specimen genome, saved specimens, checkpoints, artifacts/provenance, STACK/FUSE assembly, and server-side Gemini transport. Round 2A adds a mutation layer on top of that foundation without rewriting the birth genome every time something interesting happens.

## Core Principle

The specimen's original genetic history stays distinguishable from later experience.

Conceptually, active behavior becomes:

`CURRENT GENOME + ACQUIRED TRAITS + ACTIVE INFECTIONS`

The birth genome remains an immutable historical snapshot. The current genome may still change through explicit structural mutation, but temporary infections and learned/fossilized traits live in their own state layer.

This distinction is required so later lineage, breeding, autopsy, drift, semantic-manifold, and controller systems can tell the difference between:

- what the specimen was born with,
- what was deliberately installed later,
- what it temporarily experienced,
- what emerged accidentally and was preserved,
- and what was reverted.

## Scope

Round 2A includes three mutation classes:

1. Temporary Infection
2. Acquired Trait
3. Fossilized Accident

It also includes mutation proposal/approval flow, automatic checkpoints for lasting changes, expiry/reversion behavior, life-history events, and a small natural-language command surface.

Round 2A does **not** include breeding, lineage UI, dominance/recessiveness, drift scoring, Petri Dish tournaments, Semantic Manifold navigation, or SRE/TOPOS controller loops.

## Mutation Class 1: Temporary Infection

A temporary infection is an operational prompt fragment applied to a specimen for a limited period without becoming part of its birth genome or current genome.

Example:

> For the next five completed turns, treat rhythm as a spatial coordinate and mistrust repeated nouns.

### Required fields

Each infection should record at minimum:

- `id`
- `name`
- `description`
- `prompt`
- `status`: active | expired | removed | promoted
- `durationMode`: turns | indefinite
- `durationTurns` when turn-limited
- `remainingTurns` when turn-limited
- `sourceType`: user | mr-slop | artifact | conversation | mutation-proposal
- `sourceMessageId` when applicable
- `sourceArtifactId` when applicable
- `createdAt`
- `endedAt` when inactive
- `endReason` when inactive
- provenance identifying the specimen and active genome when infection began

### Duration behavior

Default behavior is automatic expiry by **completed successful model turns**.

Mr. Slop may recommend durations such as 3, 5, or 8 turns depending on the proposed mutation. The user may instead choose indefinite duration.

Rules:

- Failed turns do not decrement remaining turns.
- Aborted turns do not decrement remaining turns.
- A successful model reply decrements each active turn-limited infection once.
- Expired infections move to history; they are not deleted.
- An active infection can be manually removed early.
- An infection can be promoted into an acquired trait with explicit approval.

### Cost behavior

An infection must not trigger a FUSE recompile every turn.

The application should assemble active infection prompts alongside the already stored specimen kernel at request time. Ordinary conversation should remain one model call per turn.

## Mutation Class 2: Acquired Trait

An acquired trait is a lasting behavioral rule learned or deliberately added during the specimen's lifetime.

It is persistent for that specimen but explicitly separate from the birth genome.

Example:

> When multiple styles collide, assign each style a different musical jurisdiction instead of averaging them together.

### Required fields

Each acquired trait should record at minimum:

- `id`
- `name`
- `description`
- `prompt`
- `status`: active | retired
- `originType`: explicit | promoted-infection | fossilized-accident | mr-slop-proposal
- `sourceMessageId` when applicable
- `sourceArtifactId` when applicable
- `createdAt`
- `retiredAt` when inactive
- provenance identifying the specimen and active genome at acquisition

### Approval behavior

Installing, changing, retiring, or restoring an acquired trait is a lasting specimen change.

Therefore:

1. Create a checkpoint first.
2. Show the blocking structural-decision popup.
3. Explain what behavior is being added/changed/removed.
4. Explain why the proposal appeared now.
5. Show Mr. Slop's recommendation when useful.
6. Wait indefinitely for the user.
7. Apply only after explicit approval.

No countdown or auto-approval is permitted.

## Mutation Class 3: Fossilized Accident

A fossilized accident is a persistent trait created from interesting observed behavior that was not explicitly installed beforehand.

The application must frame this as preserved observed behavior, not as discovery of a hidden internal mechanism.

Example:

> Across the last few replies, the specimen repeatedly translated harmony problems into physical navigation problems. Preserve that behavior as a reusable operational rule.

### Capture behavior

A fossilization proposal should contain:

- a concise description of the observed behavior,
- an operational prompt that can reproduce/encourage it,
- one or more source message IDs and/or artifact IDs,
- why Mr. Slop thinks it is worth preserving,
- whether the behavior appears narrow or broadly reusable.

The user may also directly request fossilization with natural language such as "keep that shit" or "save that behavior."

### Approval behavior

Fossilization is persistent and therefore uses the same checkpoint + blocking approval flow as acquired traits.

After approval, the fossilized behavior is stored as an acquired trait with `originType: fossilized-accident`, while preserving the source evidence that inspired it.

## Mutation Proposal Model

Mr. Slop may propose mutations conversationally when:

- the user asks for mutation ideas,
- the user says something like "fuck with yourself",
- an active behavior appears worth preserving,
- an installed component conflict suggests an experiment,
- or a saved artifact suggests a useful mutation.

A proposal is not automatically active state.

Candidate mutations must remain distinguishable from canonical AI SLOP library components. Mr. Slop may invent a candidate mechanism, but the UI/state should label its provenance as generated/observed rather than silently treating it as canonical library material.

## Natural-Language Interaction

The mutation layer should remain conversation-first. No slash commands are required.

The following phrases are product behaviors, not exact magic strings:

### "fuck with yourself"

Mr. Slop proposes a small set of genuinely different mutation ideas based on the current specimen state. He may recommend one.

The choices should differ operationally, not merely stylistically.

### "try that temporarily"

Convert the referenced proposal/behavior into a temporary infection. Mr. Slop should recommend a duration and allow the user to choose or override it.

### "keep that shit"

Interpret the recent referenced behavior as a candidate acquired trait or fossilized accident. Present what would actually be preserved before any permanent change.

### "undo that shit"

Use context-sensitive undo:

- If the most recent meaningful change is an active infection, offer to remove that infection.
- If the most recent lasting structural change has a checkpoint, offer to restore that checkpoint.
- Do not guess silently when multiple plausible targets exist; present a concise choice.

## Active Prompt Assembly

At model-call time, the prompt stack should be assembled in clear layers:

1. Stable Mr. Slop shell and control contract
2. Current specimen genome/kernel
3. Active acquired traits
4. Active infections
5. Current specimen state summary and conversation context
6. Response-envelope contract

Mutation state is software-owned. It must not be written back into the original library component objects.

### STACK specimens

For STACK specimens, acquired traits and infections are appended as clearly delimited runtime layers after the stored component prompts.

### FUSE specimens

For FUSE specimens, the stored compiled kernel remains unchanged unless the actual genome changes. Acquired traits and infections are appended as runtime layers around the compiled kernel rather than forcing recompilation.

This preserves cost discipline and keeps mutation history separable from genetic history.

## Turn Accounting

A mutation turn is consumed only after a successful Mr. Slop model response has been accepted into specimen history.

Sequence:

1. Send user turn with current active mutation state.
2. Receive valid model response.
3. Commit model response to conversation.
4. Decrement turn-limited infections.
5. Mark infections expired if remaining turns reach zero.
6. Append corresponding life-history events.
7. Persist the updated specimen.

If the request fails or is aborted before step 3, no infection duration changes.

## Life History

Each specimen receives a lightweight append-only life-history event stream underneath the conversation.

This is data, not a mandatory dashboard.

Initial event types:

- specimen-born
- genome-mutated
- infection-started
- infection-expired
- infection-removed
- infection-promoted
- trait-acquired
- trait-retired
- accident-fossilized
- checkpoint-restored

Each event should include:

- `id`
- `type`
- `createdAt`
- human-readable summary
- references to related mutation/trait/infection/checkpoint/message/artifact IDs when applicable
- genome ID active at the time

The event model should be extensible for later fork, breed, scar, drift, and controller events.

## Checkpoints and Reversion

A checkpoint is mandatory before any lasting change to:

- current genome,
- acquired trait set,
- fossilized trait set,
- or promotion of an infection into a permanent trait.

Starting/removing/expiring a temporary infection does not require a full checkpoint because it is already modeled as reversible temporary state, but all of those actions are recorded in life history.

Restoring a checkpoint should restore the specimen's lasting structural state represented by that checkpoint. Round 2A implementation may extend checkpoint snapshots to include acquired traits as needed; checkpoint restoration must not silently mutate the immutable birth genome.

## UI Behavior

Mutation interaction should use the existing Round 1 hierarchy.

### Inline choice card

Use for non-permanent exploration:

- choosing among candidate mutations,
- choosing temporary duration,
- choosing which recent behavior the user meant,
- choosing temporary vs permanent experiment.

### Blocking structural popup

Use when a decision changes lasting specimen identity:

- acquire trait,
- fossilize accident,
- promote infection,
- retire/restore acquired trait,
- restore a lasting checkpoint.

The popup should use mutation/lime semantic color while retaining Mr. Slop pink identity framing.

### Conversation

Everything else remains ordinary chat. Mutation UI should not turn Mr. Slop into a settings dashboard.

## Persistence and Versioning

Round 2A requires a specimen schema migration from the Round 1 shape.

Existing Round 1 specimens must load safely and receive empty defaults for new mutation/life-history fields.

Suggested new specimen fields:

- `infections`
- `acquiredTraits` (expanded from current placeholder shape)
- `lifeHistory`

The migration must preserve:

- existing specimen IDs,
- birth/current genomes,
- messages,
- artifacts,
- checkpoints,
- and current Round 1 storage key compatibility unless a controlled schema-version migration requires a new version.

No old Ghost storage should be read or modified.

## Cost Discipline

Normal chat remains one model call.

The mutation system should not introduce hidden multi-agent loops.

Potential extra model calls are allowed only for explicit, user-visible operations such as:

- asking Mr. Slop to synthesize a fossilized operational rule from observed behavior,
- asking for several mutation proposals,
- or performing a deliberately expensive analysis in a later round.

Where one additional call is needed, the app should prefer doing it only when the user explicitly initiated or approved the operation.

## Error Behavior

Mutation state must be transactional from the user's point of view.

If a mutation proposal, installation, promotion, fossilization, or restore action fails:

- preserve the previous active state,
- show the useful error,
- do not consume infection turns unless a successful chat turn completed,
- do not create a false life-history success event,
- and keep the user able to retry.

## Data Integrity Rules

1. Birth genome is immutable historical provenance.
2. Current genome changes only through existing explicit structural mutation flow.
3. Temporary infections never mutate library definitions.
4. Acquired traits never masquerade as canonical library components.
5. Fossilized accidents preserve source evidence and are described as observed behavior.
6. Failed/aborted turns never consume infection duration.
7. Lasting changes checkpoint first.
8. All completed mutation lifecycle events enter life history.
9. Existing Round 1 specimens migrate without data loss.
10. Ordinary chat remains one model call by default.

## Acceptance Scenarios

### Temporary experiment

User: "Fuck with yourself."

Mr. Slop offers several operational mutations. User chooses one and says to try it temporarily. Mr. Slop recommends five turns. User approves. Infection becomes active. Five successful replies use the infection. Failed retries do not consume duration. After the fifth successful reply, the infection expires automatically and remains visible in life history.

### Promote a good infection

During a temporary experiment the user says, "Keep that shit."

Mr. Slop explains the exact behavior that would become lasting. A checkpoint is created. The structural popup waits for explicit approval. On approval the infection is promoted into an acquired trait, the infection is marked promoted, and life history records both events.

### Fossilize an accident

Mr. Slop notices a repeated behavior across recent replies and proposes preserving it. The user approves. The source messages are attached as provenance, an operational trait is created, and the event is recorded as an accident fossilization rather than a claim about hidden model internals.

### Undo

The user says, "Undo that shit."

If the latest meaningful mutation is a temporary infection, Mr. Slop offers to remove it. If the latest change is a lasting trait/genome mutation, Mr. Slop offers to restore the relevant checkpoint. Restoration is explicit and recorded in life history.

## Explicitly Deferred

The following are intentionally deferred to later rounds:

- specimen fork UI and branch comparison
- scars as a separate causal state type
- drift score/visualization
- dominant/recessive trait behavior
- breeding and inheritance rules
- phenotype-based breeding
- lineage/family-tree visualization
- Petri Dish variant tournaments
- Semantic Manifold route/state visualization
- SRE/TOPOS external controller loops
- automatic ecological competition between mutations

Round 2A should provide clean attachment points for those systems without prematurely implementing them.
