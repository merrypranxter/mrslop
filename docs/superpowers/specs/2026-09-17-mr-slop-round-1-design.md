# Mr. Slop — Round 1 Design

Date: 2026-09-17
Status: Design approved in conversation; implementation not started
Repository: `merrypranxter/mrslop`
Primary source library: `merrypranxter/ai_slop`

## 1. Product intent

Mr. Slop is a conversational experimental-creature builder.

The primary interface is **talking**, not operating a dashboard. The user should be able to open Mr. Slop, choose a simple way to begin, talk through what they have in mind, let Mr. Slop suggest mechanisms and combinations, approve a starting construction, and then continue talking to the resulting specimen as a normal conversational entity.

The first version is deliberately smaller than the eventual system. It establishes a clean specimen/genome architecture so later Semantic Manifold, SRE/TOPOS, breeding, lineage, and multi-specimen experiments can attach without requiring a rewrite.

Round 1 success is:

`BUILD ME → choose how to start → discuss the build → approve a genome → spawn specimen → keep talking → save/reopen specimen`

The interaction should feel like a weird collaborator with a laboratory hidden underneath, not a laboratory UI with a chatbot attached.

## 2. Relationship to Ghost

The current repository contains a Ghost-derived starter. Round 1 uses a **selective transplant** strategy.

Keep or adapt plumbing that is genuinely useful:

- React/Vite project shape;
- persistent local sessions/storage;
- file attachment handling;
- export utilities;
- speech/audio utilities where they remain cleanly separable;
- proven chat scrolling/input behavior;
- useful message actions;
- lightweight CRT/glitch rendering ideas.

Replace rather than inherit:

- the Ghost identity;
- the current monolithic `SYSTEM_INSTRUCTION` and legacy Ghost protocols;
- green monochrome visual language;
- generic `Session`-only state model;
- any assumption that the model itself owns persistent experimental state;
- any architecture that requires interface actions to be encoded as mysterious prompt tags when explicit app state/actions can do the job more reliably.

Mr. Slop should be a clean system that happens to reuse good parts from Ghost, not a recolored Ghost fork.

## 3. Core interaction philosophy

### Conversation first

Normal work happens in chat. The user can say things such as:

- “I want something that makes rocking Suno slop but the musical systems fight over different jobs.”
- “Give me something random.”
- “The second one, but make the singing stranger.”
- “Keep that weird thing.”
- “Go back before that happened.”
- “What can I tweak here?”

Mr. Slop interprets natural language into proposed mechanisms and operations. No slash-command syntax is required.

### Mr. Slop remains recognizable

Every specimen retains a thin, stable Mr. Slop shell: curious, collaborative, dry/funny, experimental, willing to explain why something may be interesting, and comfortable with informal language.

The installed genome changes how the specimen notices, compares, selects, preserves, mutates, or structures ideas. It should not erase the underlying conversational identity unless a later explicit feature is designed to do so.

### Suggestions are not decisions

Ordinary suggestions stay in chat or lightweight choice cards.

A stronger blocking popup appears only when the user is about to make a lasting or structurally important change. It always waits for explicit user action. There are no countdowns and no automatic continuation through a structural fork.

## 4. First-run experience

The initial screen is intentionally sparse.

Primary identity:

**MR. SLOP**

Primary action:

**BUILD ME**

Selecting BUILD ME reveals one compact start card with four routes:

1. **SURPRISE ME** — assemble a weird but structurally meaningful starting genome.
2. **I HAVE AN IDEA** — enter chat immediately; the user explains the idea and Mr. Slop proposes ways to construct himself for it.
3. **LET ME PICK THE PARTS** — open the explicit installable-module picker.
4. **START FROM A SPECIMEN** — reopen/clone a previously saved specimen; unavailable only when none exist yet.

After the initial route is chosen, the main experience becomes chat.

## 5. Visual identity

The base canvas is nearly black. Neon color is functional but intentionally messy enough to feel like a corrupted laboratory organism rather than a clean SaaS design system.

Color semantics:

- **hot pink / magenta** — Mr. Slop identity and primary conversational accents;
- **electric cyan** — ideas, options, proposed directions;
- **acid lime** — mutations and active structural changes;
- **ultraviolet / purple** — genome, minds, deep system structure;
- **tangerine / orange** — conflicts, warnings, expensive actions, decisions that require attention;
- **high yellow** — discoveries, emergent behavior, fossilization opportunities;
- **cobalt / electric blue** — history, checkpoints, saved state, provenance;
- **pearlescent white / chrome** — neutral selection and clean emphasis.

The base should not be equally saturated everywhere. Neon should flare around meaningful events and controls.

Visual texture can include restrained CRT scanlines, phosphor glow, chromatic aberration, slight glitch motion, and occasional holographic/iridescent effects. These effects must not damage readability or mobile usability.

Important structural-decision popups should visually interrupt: centered modal/card, slight background dim, brighter neon state, and clear explanation before controls.

## 6. Interaction surfaces

Round 1 uses four surfaces only.

### A. Chat

The default and dominant surface.

### B. Conversational choice card

Used when Mr. Slop has a few useful alternatives. It is non-blocking in the conceptual sense: the user may click an option or simply answer in words.

Examples:

- three candidate build directions;
- three mutations to try next;
- several different ways to divide musical jurisdictions.

### C. Structural decision popup

Used only when the choice changes what the specimen **is**, not merely what it does next.

Triggers include:

- installing/removing a genome component after spawn;
- making a temporary behavior permanent;
- changing STACK/FUSE strategy;
- activating a dormant component when that becomes supported;
- resolving an important module conflict;
- creating a branch/clone when branch behavior is added;
- later: breeding or other lineage changes;
- a materially more expensive generation strategy that would consume substantially more model calls.

Every popup must contain:

- **Why this opened** — plain-language reason tied to the current conversation;
- relevant controls/options only;
- what each choice changes;
- Mr. Slop’s recommendation, if he has one;
- explicit action to apply;
- option to close and answer conversationally instead.

The app must wait indefinitely for the user.

### D. Explicit part picker

Used only when the user chooses LET ME PICK THE PARTS or explicitly asks to browse the machinery.

It is searchable and category-based but should not become the default interaction model.

## 7. Specimen and genome model

The Round 1 data model must separate the stable birth recipe, mutable current state, conversation, and generated artifacts.

Conceptual types:

```ts
type ComponentKind =
  | 'mind'
  | 'operator'
  | 'regulator'
  | 'seed'
  | 'media'
  | 'custom';

type GenomeComponent = {
  id: string;
  name: string;
  kind: ComponentKind;
  version: string;
  sourceRepo?: string;
  sourcePath?: string;
  sourceSha?: string;
  description: string;
  prompt: string;
  tags: string[];
  roleHints?: string[];
  tokenEstimate?: number;
  enabled: boolean;
  order: number;
};

type Genome = {
  id: string;
  mode: 'stack' | 'fuse';
  components: GenomeComponent[];
  customSeed?: string;
  compiledKernel?: string;
  compiledAt?: number;
  compilerVersion?: string;
};

type Specimen = {
  id: string;
  name: string;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Message[];
  artifacts: Artifact[];
  checkpoints: Checkpoint[];
  createdAt: number;
  lastModified: number;

  // Future attachment points. Present in the architecture but unused or empty in Round 1.
  acquiredTraits?: AcquiredTrait[];
  scars?: unknown[];
  trajectory?: unknown;
  controllerState?: unknown;
  metrics?: unknown;
  lineage?: unknown;
};
```

Exact field names may change during implementation, but the separation of concerns is required.

### Versioned genetics

A specimen must preserve the exact component content/version used at birth. Future updates to `ai_slop` must not silently rewrite old specimens.

A later feature may offer an upgrade/migration path, but Round 1 should already make reproducibility possible by storing source/version provenance and the installed prompt body.

## 8. Mr. Slop shell versus specimen kernel

The model instruction is assembled from distinct layers rather than one giant constant.

Recommended order:

1. **MR_SLOP_BASE_SHELL** — stable conversational identity and interaction contract.
2. **KERNEL_PROTOCOL** — tells the model how installed components should be treated and how conflicts are represented.
3. **SPECIMEN_KERNEL** — STACK output or saved FUSE output.
4. **CURRENT SPECIMEN STATE** — minimal software-owned state that genuinely needs to be visible to the model.
5. normal conversation context.

The Mr. Slop base shell should be comparatively small. The AI Slop library should supply the unusual cognitive machinery.

The app must not send the entire `ai_slop` repository on every request.

## 9. Build modes

### STACK

Selected component prompts are installed intact using deterministic separators and stable order.

Contradictions are allowed. Mr. Slop may discuss them, but the software does not silently average them away.

Ordering is stored as part of the genome because prompt order may matter.

### FUSE

FUSE performs a one-time compilation when a specimen is created or when the genome structurally changes.

The compiler is instructed to:

- preserve every selected mechanism as causally active;
- assign separate jurisdictions where mechanisms would otherwise overwrite each other;
- preserve productive contradiction where reconciliation would destroy the point;
- avoid reducing the result to generic “be creative/weird” language;
- produce a compact operational kernel;
- report which source components it incorporated.

The compiled result is persisted and reused. FUSE must not recompile on every chat turn.

### BREED

Not implemented in Round 1. The data model should not block it later.

## 10. Installable AI SLOP library — Round 1

Round 1 should be useful enough to create genuinely different specimens, not merely demonstrate the UI.

### Required: all 26 Temporary Minds

Source: `ai_readable/personality_prompts/04-temporary-minds-26-prompt-library.md`.

All 26 finished installable prompts are included as versioned `mind` components.

### Required: non-duplicate reusable operators and regulators

Source: `docs/02-mechanisms/operator-registry.md` and its machine-readable companion.

Operators whose functionality is already fully represented by one of the 26 Temporary Minds should generally not be duplicated as separate cards in the initial picker unless the operator form offers a meaningfully smaller/surgical installation.

High-value additional components for Round 1 include:

- Separated Jurisdictions;
- Anchor + Mutation Field;
- Cross-Domain Simulation / Concept Transduction;
- Structural Satiation / Conceptual Allergy;
- Cliché Mortality / Operator Burnout;
- Material Anchoring;
- Causal Artifact Chain;
- Observer / Medium Coupling;
- Recursive Artifact Fossilization;
- Attractor Lock → Perturb;
- Token / Capability Tax;
- Symbolic Compression;
- Hysteretic / Non-Commutative Iteration.

These give Mr. Slop useful machinery that is not just another copy of a Temporary Mind.

### Additional Round 1 seed

Include **The Eccentric Kineticist** from `ai_readable/personality_prompts/05-outside-the-box-guy-prompt.md` as an optional `seed`/standalone cognitive style, clearly distinguished from the 26 Temporary Minds.

### Not automatically installed in Round 1

Large research transcripts, archive/flavor jailbreak-roleplay artifacts, and giant source documents are not shipped as ordinary installable modules just because they exist in the repository. They may be mined later into compact mechanisms.

This keeps the library operational rather than turning the picker into a file browser.

## 11. Library record requirements

Each installable component must carry:

- stable ID;
- display name;
- category/kind;
- plain-English description;
- operational prompt body;
- source repository/path;
- source SHA or source-version marker;
- tags;
- optional role hints such as `memory`, `selection`, `perception`, `structure`, `media`, `regulator`;
- approximate token/character weight;
- status flags such as experimental/procedural where useful.

Mr. Slop may hide these details during ordinary conversation, but the data must exist.

## 12. Conversational build behavior

### I HAVE AN IDEA

The user describes an intention in ordinary language.

Mr. Slop should:

1. identify the actual structural need rather than merely matching aesthetic words;
2. retrieve a small relevant subset of installable components;
3. explain the proposed mechanisms in plain language first;
4. optionally expose source/library names in secondary text;
5. present a small number of meaningfully different build directions when useful;
6. wait for the user to choose or respond conversationally;
7. assemble the selected genome;
8. spawn the specimen and continue the same conversation without a hard context break.

### SURPRISE ME

Randomization should be structured rather than uniform roulette.

The selector should try to construct a viable strange combination using complementary roles, for example:

- one mind affecting cognition/ontology;
- one selection or salience mechanism;
- one structural/constraint operator;
- optionally one regulator or media-oriented operator.

A future “true chaos draw” may ignore role balance, but Round 1 SURPRISE ME should usually produce a usable specimen.

### LET ME PICK THE PARTS

The user may select as many components as desired, subject to a kernel-size warning.

The app warns rather than silently truncates. It should provide an approximate prompt-weight meter.

## 13. Persistence and checkpoints

Use local-first persistence for Round 1.

Requirements:

- specimen list survives reload;
- each specimen preserves exact birth and current genome;
- compiled FUSE kernel survives reload;
- messages survive reload;
- artifacts/checkpoints survive reload;
- schema version is stored so future migrations are possible.

Automatic checkpoints should be created immediately before structural genome changes. Saving/checkpointing itself is non-destructive and should not require a user popup.

Round 1 does not need cloud sync.

## 14. Artifacts and provenance

The schema should support outputs that become reusable artifacts even if the first UI is minimal.

Examples:

- Suno prompt;
- image/video prompt;
- shader/GLSL prompt;
- system prompt;
- structured experiment note.

Each artifact should be able to record:

- specimen ID;
- conversation message/turn where it emerged;
- current genome ID/version;
- relevant installed components;
- optional mutation/state note;
- creation time.

The point is reproducibility: later “what did we do to make this?” can be answered from stored provenance rather than model guesswork.

## 15. Model-call and cost discipline

Round 1 defaults to **one model request per ordinary conversational turn**.

Additional calls are allowed only when they correspond to explicit operations such as:

- FUSE compilation at spawn or structural mutation;
- an explicitly requested multi-candidate comparison;
- another clearly user-approved expensive operation.

The app must not silently run multi-agent loops or repeated critique passes.

Kernel compilation is cached/persisted.

Conversation context should remain bounded. The exact history strategy may evolve, but the installed kernel remains separate from chat history and is always reproducible from specimen data.

## 16. Error handling

Round 1 should fail in understandable ways.

### Model/API failure

- preserve the user’s unsent/failed message;
- show a concise retry state;
- never corrupt the specimen genome because a generation failed;
- never rerun expensive compilation automatically in a loop.

### FUSE failure

- retain the source genome untouched;
- allow retry;
- allow fallback to STACK;
- do not treat a partial compiler response as the specimen’s canonical kernel.

### Persistence failure

- keep active in-memory state when possible;
- surface that saving failed;
- avoid pretending the specimen was persisted.

### Oversized kernel

- show approximate weight before spawn or structural apply;
- explain which components dominate the size;
- allow the user to remove components or choose FUSE for compression;
- do not silently drop components.

## 17. Security and technical honesty

Mr. Slop is an experimental creative system, not a claim that prompts literally rewrite model weights, hidden states, or native latent geometry.

Where AI Slop source material uses theatrical “jailbreak,” “system collapse,” or hidden-state language, Round 1 should preserve creative mechanisms without representing those theatrical claims as technical facts.

Persistent state belongs to the software. The model receives selected state as input; it does not secretly own the experiment.

This framing intentionally leaves clean future attachment points for Semantic Manifold and SRE/TOPOS, both of which benefit from explicit external state.

## 18. Component boundaries

Implementation should prefer focused modules over another giant `Terminal.tsx`.

Expected conceptual boundaries:

- `ui/shell` — overall Mr. Slop visual frame;
- `chat` — messages, input, streaming/rendering;
- `build` — BUILD ME flow and conversational build state;
- `library` — installable component catalog and search/filter logic;
- `genome` — data model, validation, STACK assembly, FUSE inputs;
- `specimens` — persistence, checkpoints, reopen/save;
- `decisions` — choice cards and structural modal state;
- `model` — Gemini client only; does not own product state;
- `artifacts` — artifact records/provenance;
- `theme` — neon color semantics and shared visual tokens.

Existing Ghost-derived files may be split or replaced to reach these boundaries.

## 19. Testing strategy

Round 1 needs automated checks around the stateful parts even if visual polish is validated manually.

Minimum automated coverage:

- genome serialization/deserialization;
- component version/provenance retention;
- STACK assembly order and delimiters;
- FUSE result persistence and fallback behavior;
- specimen persistence/reopen;
- checkpoint-before-structural-change behavior;
- decision modal never auto-applies;
- SURPRISE ME returns a valid component combination rather than an empty/duplicate-only genome;
- oversized-kernel warning calculation;
- failed model call does not mutate canonical genome state.

Manual validation:

- mobile layout;
- BUILD ME first-run flow;
- readable neon color hierarchy;
- modal attention without becoming annoying;
- natural-language conversation remains the dominant interaction;
- user can complete a full build without learning module names.

## 20. Round 1 non-goals

Do not implement yet:

- Semantic Manifold navigation;
- SRE/TOPOS controller loop;
- breeding / Meta-Genomic offspring UI;
- Petri Dish multi-specimen tournament;
- elaborate lineage visualization;
- dormant-gene trigger engine;
- phenotype analytics;
- automatic promotion of emergent operators into the canonical library;
- cloud synchronization;
- full media-specific Suno/image/video/GLSL projection engines.

The schema may reserve attachment points for these features, but no fake placeholder UI should suggest they already work.

## 21. Round 1 acceptance scenario

A successful first build should support this end-to-end experience:

1. User opens Mr. Slop on phone or desktop.
2. App presents a dark neon MR. SLOP screen and BUILD ME.
3. User chooses I HAVE AN IDEA.
4. User says: “I want a weirdo that makes rocking Suno slop with musical systems fighting over different jobs.”
5. Mr. Slop responds conversationally and proposes a few structurally distinct approaches using relevant library mechanisms such as Separated Jurisdictions plus selected Temporary Minds/operators.
6. User chooses one in chat or via a small choice card.
7. Mr. Slop shows the proposed build in plain English and spawns the specimen after approval.
8. The same conversation continues with the installed genome active.
9. A later structural change invokes a blocking neon decision popup explaining why the change matters and waits for the user.
10. The specimen is saved locally with exact genome/version/provenance and can be reopened after reload.

If Round 1 does this well, it has succeeded.

## 22. Future compatibility contract

Round 1 must preserve clean extension points for:

- **Semantic Manifold:** trajectory, route history, scars, metrics, current interpretation, path-dependent state;
- **SRE/TOPOS:** external controller state, cycle count, attractor diagnostics, operators, perturbations, mutation ledger;
- **Breeding/lineage:** parent specimen IDs, offspring genomes, mutation records;
- **Petri Dish:** parallel offspring/variant runs from a shared checkpoint;
- **media projections:** compile the current specimen state into Suno/image/video/GLSL artifacts without turning those artifacts into the canonical specimen itself.

The governing principle is: **the specimen is the persistent stateful object; prompts and media outputs are projections of that object.**
