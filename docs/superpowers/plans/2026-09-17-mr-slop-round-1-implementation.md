# Mr. Slop Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Ghost-derived starter into a mobile-first, conversation-first Mr. Slop app that can build, spawn, persist, and reopen versioned AI-SLOP specimens using all 26 Temporary Minds plus the selected reusable operators.

**Architecture:** Keep the useful React/Vite, attachment, export, speech, and LocalForage plumbing, but replace the Ghost identity and monolithic system prompt with a domain-first specimen/genome model. Mr. Slop uses a small stable conversational shell, a versioned installable component library, deterministic STACK kernels, one-time cached FUSE kernels, structured conversational UI events, and software-owned persistence. Ordinary chat remains one model call per turn.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, `@google/genai`, LocalForage, Lucide React, Vitest, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-17-mr-slop-round-1-design.md`

## Global Constraints

- The primary interface is conversation; configuration UI is secondary and contextual.
- Every specimen retains a thin, recognizable Mr. Slop personality.
- Structural decision popups always wait for explicit user input; no countdowns or auto-apply.
- Ordinary conversation uses one model request per turn.
- FUSE compilation happens only at spawn or structural genome change and is persisted.
- Old specimens preserve the exact component prompt bodies and provenance used at birth.
- The app must not send the entire `ai_slop` repository on every request.
- Round 1 includes all 26 Temporary Minds, the selected non-duplicate reusable operators/regulators, and The Eccentric Kineticist seed.
- Semantic Manifold, SRE/TOPOS, breeding, Petri Dish tournaments, and lineage visualization are not implemented in Round 1.
- Mobile usability and readable text take priority over decorative CRT/glitch effects.
- Existing `ghost_sessions` data is left untouched; Mr. Slop uses a new storage key.

---

## File Structure Locked for Round 1

### Domain and pure logic
- `types.ts` — shared message, attachment, genome, specimen, artifact, checkpoint, UI-event types.
- `lib/genome.ts` — genome creation, cloning, weight estimation, structured surprise selection.
- `lib/kernel.ts` — STACK kernel compilation and final system-instruction assembly.
- `lib/catalog.ts` — compact catalog summaries for conversational build mode.

### Prompt and library data
- `prompts/mrSlopBase.ts` — stable Mr. Slop identity and builder/specimen interaction contract.
- `prompts/kernelProtocol.ts` — instructions for respecting installed component mechanics.
- `data/slopLibrary.ts` — pinned Round 1 installable component snapshot with provenance.

### Services
- `services/geminiService.ts` — one-call conversational transport returning a structured response envelope.
- `services/kernelCompiler.ts` — one-time FUSE compiler call; never used for ordinary chat.
- `services/specimenStore.ts` — LocalForage persistence, schema versioning, checkpoints.
- Existing `fileService.ts`, `audioService.ts`, `speechService.ts`, and `exportService.ts` remain reusable unless a concrete incompatibility is found.

### UI
- `components/MrSlopTerminal.tsx` — conversation/specimen orchestration only.
- `components/BuildMeScreen.tsx` — first-run BUILD ME experience and four start routes.
- `components/PartPicker.tsx` — explicit searchable component picker.
- `components/ChoiceCard.tsx` — lightweight conversational options.
- `components/StructuralDecisionModal.tsx` — blocking structural-change popup.
- `components/SpecimenSidebar.tsx` — saved specimens/history.
- `App.tsx` — neon shell and top-level screen routing.
- `index.css` — neon semantic tokens, CRT texture, mobile-safe layout.

### Tests
- `tests/genome.test.ts`
- `tests/kernel.test.ts`
- `tests/library.test.ts`
- `tests/specimenStore.test.ts`
- `tests/buildMeScreen.test.tsx`
- `tests/structuralDecisionModal.test.tsx`
- `tests/mrSlopTerminal.test.tsx`

---

### Task 1: Project Identity, Test Harness, and Specimen Domain

**Files:**
- Modify: `package.json`
- Modify: `metadata.json`
- Replace: `types.ts`
- Create: `lib/genome.ts`
- Create: `vitest.config.ts`
- Create: `tests/genome.test.ts`

**Interfaces:**
- Produces: `GenomeComponent`, `Genome`, `Specimen`, `Artifact`, `Checkpoint`, `MrSlopResponseEnvelope`, `ChoiceCardEvent`, `StructuralDecisionEvent`.
- Produces: `createGenome(componentIds, library, mode, customSeed?)`, `cloneGenome(genome)`, `estimateGenomeChars(genome)`, `selectSurpriseComponents(library, rng?)`.
- Later tasks consume these exact types and function names.

- [ ] **Step 1: Rename the package and add the test stack**

Change `package.json` name to `mr-slop` and add scripts/dependencies:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^26.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "vitest": "^3.0.0"
  }
}
```

Keep the current runtime dependencies unless a later task proves one is unused.

- [ ] **Step 2: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
    globals: true,
  },
});
```

- [ ] **Step 3: Replace the generic Session-only schema with Mr. Slop domain types**

Keep the existing `Role`, `Message`, and `Attachment` names so reusable services do not break. Add these exact contracts to `types.ts`:

```ts
export type ComponentKind = 'mind' | 'operator' | 'regulator' | 'seed' | 'media' | 'custom';
export type GenomeMode = 'stack' | 'fuse';
export type SpecimenPhase = 'building' | 'spawned';

export interface GenomeComponent {
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
  roleHints: string[];
  status?: 'procedural' | 'experimental' | 'observed' | 'speculative';
  enabled: boolean;
  order: number;
  charWeight: number;
}

export interface Genome {
  id: string;
  mode: GenomeMode;
  components: GenomeComponent[];
  customSeed?: string;
  compiledKernel?: string;
  compiledAt?: number;
  compilerVersion?: string;
}

export interface Artifact {
  id: string;
  specimenId: string;
  messageId?: string;
  kind: 'suno' | 'image-prompt' | 'video-prompt' | 'shader' | 'system-prompt' | 'note' | 'other';
  title: string;
  content: string;
  genomeId: string;
  componentIds: string[];
  createdAt: number;
}

export interface Checkpoint {
  id: string;
  reason: string;
  genome: Genome;
  createdAt: number;
}

export interface AcquiredTrait {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  createdAt: number;
}

export interface Specimen {
  schemaVersion: 1;
  id: string;
  name: string;
  phase: SpecimenPhase;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Message[];
  artifacts: Artifact[];
  checkpoints: Checkpoint[];
  acquiredTraits: AcquiredTrait[];
  scars: unknown[];
  trajectory: unknown | null;
  controllerState: unknown | null;
  metrics: unknown | null;
  lineage: unknown | null;
  createdAt: number;
  lastModified: number;
}

export interface ChoiceCardOption {
  id: string;
  label: string;
  description: string;
  componentIds?: string[];
  mode?: GenomeMode;
}

export interface ChoiceCardEvent {
  type: 'choice-card';
  id: string;
  title: string;
  reason?: string;
  options: ChoiceCardOption[];
}

export interface StructuralDecisionEvent {
  type: 'structural-decision';
  id: string;
  title: string;
  reason: string;
  recommendation?: string;
  options: ChoiceCardOption[];
}

export interface MrSlopResponseEnvelope {
  text: string;
  uiEvent?: ChoiceCardEvent | StructuralDecisionEvent;
  proposedGenome?: {
    componentIds: string[];
    mode: GenomeMode;
    customSeed?: string;
  };
}
```

Remove the legacy `Session` and Ghost-only `VisualType` types after dependent files are replaced in later tasks; until then, retain a temporary compatibility alias `export type Session = Specimen` only if TypeScript requires it.

- [ ] **Step 4: Write failing genome tests**

Create `tests/genome.test.ts` with tests for deterministic ordering, snapshot cloning, size estimation, and role-balanced surprise selection. The core assertions must be:

```ts
expect(createGenome(['b', 'a'], library, 'stack').components.map(c => c.id)).toEqual(['b', 'a']);
expect(cloneGenome(genome)).not.toBe(genome);
expect(cloneGenome(genome).components[0]).not.toBe(genome.components[0]);
expect(estimateGenomeChars(genome)).toBe(genome.components.reduce((n, c) => n + c.prompt.length, 0));
expect(selectSurpriseComponents(library, () => 0).length).toBeGreaterThanOrEqual(3);
```

Use a small fixture library containing role hints `ontology`, `selection`, `structure`, and `regulator`.

- [ ] **Step 5: Run tests and verify failure**

Run:

```bash
npm install
npm test -- tests/genome.test.ts
```

Expected: FAIL because `lib/genome.ts` does not exist yet.

- [ ] **Step 6: Implement `lib/genome.ts` minimally**

Required behavior:

```ts
export const createGenome = (
  componentIds: string[],
  library: GenomeComponent[],
  mode: GenomeMode,
  customSeed?: string,
): Genome => {
  const byId = new Map(library.map(component => [component.id, component]));
  const components = componentIds.map((id, order) => {
    const source = byId.get(id);
    if (!source) throw new Error(`UNKNOWN_COMPONENT:${id}`);
    return { ...source, tags: [...source.tags], roleHints: [...source.roleHints], order };
  });
  return {
    id: crypto.randomUUID(),
    mode,
    components,
    customSeed: customSeed?.trim() || undefined,
  };
};

export const cloneGenome = (genome: Genome): Genome => ({
  ...genome,
  id: crypto.randomUUID(),
  components: genome.components.map(component => ({
    ...component,
    tags: [...component.tags],
    roleHints: [...component.roleHints],
  })),
});

export const estimateGenomeChars = (genome: Genome): number =>
  genome.components.filter(c => c.enabled).reduce((sum, c) => sum + c.prompt.length, 0) + (genome.customSeed?.length || 0);
```

`selectSurpriseComponents` must prefer one enabled component from ontology/cognition, one from selection/perception, one from structure/constraint, and optionally one regulator/operator; use the supplied `rng` for testability and deduplicate IDs.

- [ ] **Step 7: Run test, type-check, and build**

```bash
npm test -- tests/genome.test.ts
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json metadata.json types.ts lib/genome.ts vitest.config.ts tests/genome.test.ts
git commit -m "feat: establish Mr Slop specimen domain"
```

---

### Task 2: Pin the Round 1 AI-SLOP Component Library

**Files:**
- Create: `data/slopLibrary.ts`
- Create: `lib/catalog.ts`
- Create: `tests/library.test.ts`
- Read source: `merrypranxter/ai_slop/ai_readable/personality_prompts/04-temporary-minds-26-prompt-library.md`
- Read source: `merrypranxter/ai_slop/docs/02-mechanisms/operator-registry.md`
- Read source: `merrypranxter/ai_slop/ai_readable/personality_prompts/05-outside-the-box-guy-prompt.md`

**Interfaces:**
- Produces: `SLOP_LIBRARY: GenomeComponent[]`.
- Produces: `buildCatalogIndex(library): string` and `findComponentsByRole(library, role): GenomeComponent[]`.

- [ ] **Step 1: Write failing library tests**

`tests/library.test.ts` must assert:

```ts
expect(SLOP_LIBRARY.filter(c => c.kind === 'mind')).toHaveLength(26);
expect(SLOP_LIBRARY).toHaveLength(40);
expect(new Set(SLOP_LIBRARY.map(c => c.id)).size).toBe(SLOP_LIBRARY.length);
expect(SLOP_LIBRARY.every(c => c.prompt.trim().length > 40)).toBe(true);
expect(SLOP_LIBRARY.every(c => c.sourcePath && c.sourceSha)).toBe(true);
expect(buildCatalogIndex(SLOP_LIBRARY)).toContain('Separated Jurisdictions');
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/library.test.ts
```

Expected: FAIL because the library does not exist.

- [ ] **Step 3: Create the pinned 40-component snapshot**

Populate `data/slopLibrary.ts` with exactly:

- all 26 Temporary Minds from `04-temporary-minds-26-prompt-library.md` as `kind: 'mind'`;
- 13 surgical/non-duplicate extras: `separated-jurisdictions`, `anchor-mutation-field`, `concept-transduction`, `structural-satiation`, `cliche-mortality`, `material-anchoring`, `causal-artifact-chain`, `observer-medium-coupling`, `recursive-artifact-fossilization`, `attractor-lock-perturb`, `token-capability-tax`, `symbolic-compression`, `hysteretic-iteration`;
- `eccentric-kineticist` from `05-outside-the-box-guy-prompt.md` as `kind: 'seed'`.

For each Temporary Mind, copy the paste-ready operational prompt body from the source section without rewriting it. For each surgical extra, convert the canonical operator-registry definition into a compact executable instruction that preserves its operation and status without adding aesthetic flavor. Record the exact source path and current source blob SHA in every record. Set `charWeight` to `prompt.length` when constructing/exporting the array.

Temporary Mind IDs must be stable and numbered `tm-01` through `tm-26`; names must match the canonical 26-mind inventory.

- [ ] **Step 4: Implement compact catalog helpers**

`lib/catalog.ts`:

```ts
export const buildCatalogIndex = (library: GenomeComponent[]): string =>
  library
    .map(c => `${c.id} | ${c.name} | ${c.kind} | roles:${c.roleHints.join(',')} | ${c.description}`)
    .join('\n');

export const findComponentsByRole = (library: GenomeComponent[], role: string): GenomeComponent[] =>
  library.filter(c => c.enabled && c.roleHints.includes(role));
```

The catalog index contains summaries only, never full prompt bodies.

- [ ] **Step 5: Run library tests and type-check**

```bash
npm test -- tests/library.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add data/slopLibrary.ts lib/catalog.ts tests/library.test.ts
git commit -m "feat: add pinned AI Slop component library"
```

---

### Task 3: Replace the Ghost Prompt with Mr. Slop Kernel Architecture

**Files:**
- Create: `prompts/mrSlopBase.ts`
- Create: `prompts/kernelProtocol.ts`
- Create: `lib/kernel.ts`
- Create: `tests/kernel.test.ts`
- Stop importing: `SYSTEM_INSTRUCTION` from `constants.ts`

**Interfaces:**
- Produces: `MR_SLOP_BASE_SHELL`, `BUILD_MODE_INSTRUCTION`, `KERNEL_PROTOCOL`.
- Produces: `compileStackKernel(genome): string` and `assembleSystemInstruction(args): string`.

- [ ] **Step 1: Write failing kernel tests**

Tests must prove that STACK preserves order and source prompts verbatim and that builder mode receives summaries rather than full prompt bodies:

```ts
expect(compileStackKernel(genome).indexOf('PROMPT_A')).toBeLessThan(compileStackKernel(genome).indexOf('PROMPT_B'));
expect(compileStackKernel(genome)).toContain('PROMPT_A');
expect(assembleSystemInstruction({ phase: 'building', catalogIndex: 'tm-01 | X', genome: emptyGenome })).toContain('tm-01 | X');
expect(assembleSystemInstruction({ phase: 'spawned', catalogIndex: '', genome })).toContain('PROMPT_A');
```

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/kernel.test.ts
```

- [ ] **Step 3: Implement the stable Mr. Slop base shell**

`MR_SLOP_BASE_SHELL` must explicitly encode these behaviors:

```text
You are Mr. Slop, a recognizable conversational collaborator with a weird experimental lab behind you.
Conversation is the primary interface. Speak naturally, concisely when useful, and comfortably with informal language.
Help the user discover mechanisms, combinations, experiments, and mutations by discussing them rather than forcing them through forms.
Explain mechanisms in plain language before library jargon.
Do not claim prompts literally rewrite model weights, hidden states, or secret neural manifolds.
Suggestions are not structural changes. Never claim a genome-changing action happened unless the application state says it happened.
When a lasting structural change would be useful, propose it; the application must wait for the user to approve it.
Do not silently spawn multi-agent loops, repeated critique passes, or other extra model calls.
```

`BUILD_MODE_INSTRUCTION` must tell Mr. Slop to use only IDs present in the provided compact catalog and to return at most three meaningfully different build directions when options help.

- [ ] **Step 4: Implement STACK and system assembly**

`compileStackKernel` must delimit each enabled component by stable ID/name and include `customSeed` last. `assembleSystemInstruction` must layer:

```text
MR_SLOP_BASE_SHELL
KERNEL_PROTOCOL
BUILD_MODE_INSTRUCTION + compact catalog index   // building only
OR
SPECIMEN_KERNEL                                  // spawned only
CURRENT_SPECIMEN_STATE summary                   // spawned only, compact
```

If `genome.mode === 'fuse'`, spawned assembly must use `genome.compiledKernel` and throw `FUSE_KERNEL_MISSING` if absent; it must never silently fall back to STACK.

- [ ] **Step 5: Run tests and build**

```bash
npm test -- tests/kernel.test.ts
npm run lint
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add prompts/mrSlopBase.ts prompts/kernelProtocol.ts lib/kernel.ts tests/kernel.test.ts
git commit -m "feat: add Mr Slop kernel architecture"
```

---

### Task 4: Refactor Gemini Transport and Add One-Time FUSE Compilation

**Files:**
- Replace: `services/geminiService.ts`
- Create: `services/kernelCompiler.ts`
- Create: `tests/geminiEnvelope.test.ts`

**Interfaces:**
- Produces: `sendMrSlopMessage(args): Promise<MrSlopResponseEnvelope>`.
- Produces: `compileFuseGenome(genome, signal?): Promise<string>`.

- [ ] **Step 1: Write envelope parser tests**

Extract a pure `parseMrSlopEnvelope(raw: string): MrSlopResponseEnvelope` from the transport and test:

```ts
expect(parseMrSlopEnvelope('{"text":"hi"}')).toEqual({ text: 'hi' });
expect(parseMrSlopEnvelope('not json')).toEqual({ text: 'not json' });
expect(() => parseMrSlopEnvelope('{"text":"","uiEvent":{"type":"structural-decision"}}')).not.toThrow();
```

Malformed optional UI events are discarded, not allowed to crash chat.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/geminiEnvelope.test.ts
```

- [ ] **Step 3: Replace Ghost-specific transport**

`sendMrSlopMessage` accepts one object:

```ts
interface SendMrSlopArgs {
  history: Message[];
  userMessage: string;
  attachments?: Attachment[];
  systemInstruction: string;
  signal?: AbortSignal;
}
```

Keep the existing lazy API-key initialization, attachment loading, abort handling, bounded recent history, payload guard, and retry ceiling. Remove `roleMask`, Ghost `SYSTEM_INSTRUCTION`, Auto-Recon assumptions, hidden `[[EXECUTE:*]]` command parsing, and the forced Ghost file-analysis suffix.

Ask Gemini for a JSON response envelope with `text` plus optional `uiEvent`/`proposedGenome`. If the SDK response-schema feature is unavailable for the installed version, instruct JSON output and pass the raw result through `parseMrSlopEnvelope`; plain text remains a supported fallback.

- [ ] **Step 4: Implement FUSE compiler as a separate call path**

`compileFuseGenome` must:

1. reject empty genomes;
2. send only selected component names + full prompt bodies + custom seed to the compiler call;
3. instruct the compiler to preserve every mechanism as causally active, assign jurisdictions where needed, preserve productive contradiction, and output one compact operational kernel only;
4. reject empty/obviously partial results;
5. return the kernel string without mutating the input genome.

Use a distinct compiler version constant such as `MR_SLOP_FUSE_V1`.

- [ ] **Step 5: Run tests, type-check, build**

```bash
npm test -- tests/geminiEnvelope.test.ts
npm run lint
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add services/geminiService.ts services/kernelCompiler.ts tests/geminiEnvelope.test.ts
git commit -m "feat: add Mr Slop model transport and fuse compiler"
```

---

### Task 5: Local-First Specimen Persistence and Checkpoints

**Files:**
- Create: `services/specimenStore.ts`
- Create: `tests/specimenStore.test.ts`

**Interfaces:**
- Produces: `MR_SLOP_STORAGE_KEY = 'mrslop_specimens_v1'`.
- Produces: `loadSpecimens()`, `saveSpecimens(specimens)`, `makeSpecimen(genome, name?)`, `checkpointSpecimen(specimen, reason)`.

- [ ] **Step 1: Write failing persistence tests**

Mock LocalForage and assert:

```ts
expect(MR_SLOP_STORAGE_KEY).toBe('mrslop_specimens_v1');
expect(makeSpecimen(genome).schemaVersion).toBe(1);
expect(makeSpecimen(genome).birthGenome).not.toBe(makeSpecimen(genome).currentGenome);
expect(checkpointSpecimen(specimen, 'before mutation').checkpoints).toHaveLength(1);
```

Also assert `loadSpecimens()` returns `[]` for missing/corrupt data and never reads/deletes `ghost_sessions`.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/specimenStore.test.ts
```

- [ ] **Step 3: Implement storage**

Use LocalForage only. `saveSpecimens` writes an array under `mrslop_specimens_v1`. Clone genome objects when creating birth/current copies. Persist compiled FUSE kernels, messages, artifacts, and checkpoints. Leave future fields initialized to empty arrays/null.

Before structural genome replacement, callers must invoke `checkpointSpecimen` with a human-readable reason.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/specimenStore.test.ts
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add services/specimenStore.ts tests/specimenStore.test.ts
git commit -m "feat: persist Mr Slop specimens and checkpoints"
```

---

### Task 6: BUILD ME, Explicit Part Picker, and Neon Application Shell

**Files:**
- Replace: `App.tsx`
- Modify: `index.css`
- Create: `components/BuildMeScreen.tsx`
- Create: `components/PartPicker.tsx`
- Create: `tests/buildMeScreen.test.tsx`

**Interfaces:**
- `BuildMeScreen` props: `{ hasSpecimens: boolean; onStart(mode: 'surprise' | 'idea' | 'pick' | 'existing'): void }`.
- `PartPicker` props: `{ library; selectedIds; onChange(ids); onSpawn(mode); onCancel(); }`.

- [ ] **Step 1: Write failing BUILD ME tests**

Test that the first screen contains `MR. SLOP`, `BUILD ME`, and after activation exposes exactly four routes: `SURPRISE ME`, `I HAVE AN IDEA`, `LET ME PICK THE PARTS`, `START FROM A SPECIMEN`. When `hasSpecimens=false`, the last option is disabled but visible.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/buildMeScreen.test.tsx
```

- [ ] **Step 3: Implement the sparse first-run screen**

The opening screen must not show the old Ghost boot log. It uses a nearly-black canvas, prominent hot-pink Mr. Slop identity, restrained CRT texture, and one primary BUILD ME card/button before revealing the four routes.

- [ ] **Step 4: Implement the explicit picker**

Picker requirements:

- search name/description/tags;
- filter by kind;
- multi-select with no arbitrary small cap;
- show plain-English description first and source name second;
- show approximate character weight and a warning when selected prompt bodies exceed 40,000 characters;
- offer STACK and FUSE spawn actions;
- never silently remove components.

- [ ] **Step 5: Establish semantic neon CSS variables**

Add variables to `index.css`:

```css
:root {
  --slop-pink: #ff2bd6;
  --slop-cyan: #2cf6ff;
  --slop-lime: #b7ff2a;
  --slop-purple: #9b5cff;
  --slop-orange: #ff7a1a;
  --slop-yellow: #ffe84a;
  --slop-blue: #3d7cff;
  --slop-chrome: #f2f0ff;
  --slop-black: #050407;
}
```

Use pink for Mr. Slop identity, cyan for ideas/options, lime for mutation/change, purple for genome, orange for warnings/conflicts, yellow for discoveries, blue for history/provenance, chrome for neutral emphasis. Do not make the full screen uniformly saturated.

- [ ] **Step 6: Run tests and build**

```bash
npm test -- tests/buildMeScreen.test.tsx
npm run lint
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add App.tsx index.css components/BuildMeScreen.tsx components/PartPicker.tsx tests/buildMeScreen.test.tsx
git commit -m "feat: add Build Me flow and neon Mr Slop shell"
```

---

### Task 7: Conversation, Choice Cards, Structural Decisions, and Saved Specimens

**Files:**
- Create: `components/MrSlopTerminal.tsx`
- Create: `components/ChoiceCard.tsx`
- Create: `components/StructuralDecisionModal.tsx`
- Create: `components/SpecimenSidebar.tsx`
- Modify: `App.tsx`
- Reuse/adapt: `ParsedMessage.tsx`, `MessageActions.tsx`, file/audio/speech/export services
- Create: `tests/structuralDecisionModal.test.tsx`
- Create: `tests/mrSlopTerminal.test.tsx`

**Interfaces:**
- `MrSlopTerminal` owns active specimen conversation state and delegates persistence to `specimenStore`.
- `ChoiceCard` emits selected `ChoiceCardOption` but never mutates genomes itself.
- `StructuralDecisionModal` emits explicit approve/cancel/answer-in-chat results; it never auto-approves.

- [ ] **Step 1: Write modal tests**

Assertions:

```ts
expect(screen.getByText(/why this opened/i)).toBeInTheDocument();
expect(onApprove).not.toHaveBeenCalled();
```

Advance fake timers by 60 seconds and assert `onApprove` is still not called. Verify recommendation text is visible when supplied and that close/cancel does not apply anything.

- [ ] **Step 2: Write terminal integration tests with mocked model/store**

Cover:

1. ordinary send makes exactly one `sendMrSlopMessage` call;
2. a returned `choice-card` renders options without changing the genome;
3. a returned `structural-decision` opens the blocking modal and waits;
4. approval checkpoints the specimen before applying the proposed genome;
5. failure leaves the user message visible and exposes retry without corrupting the genome.

- [ ] **Step 3: Implement conversational build mode**

For `I HAVE AN IDEA`, create a building-phase specimen with an empty genome, assemble system instruction with the compact catalog index, and let the user talk immediately. If a response contains `proposedGenome`, show it as a conversational choice card; do not spawn until the user explicitly chooses it.

`SURPRISE ME` uses `selectSurpriseComponents`, creates a STACK genome, and spawns directly without an extra model call.

`LET ME PICK THE PARTS` uses `PartPicker`.

`START FROM A SPECIMEN` opens `SpecimenSidebar` and loads an existing specimen.

- [ ] **Step 4: Implement spawned conversation**

On every ordinary turn:

1. create one user `Message`;
2. build system instruction from saved specimen genome;
3. call `sendMrSlopMessage` exactly once;
4. append `envelope.text` as the model message;
5. render optional choice/decision UI event;
6. save specimen.

Retain attachment handling, stop/abort, speech input, read-aloud, and export where they remain clean. Remove Auto-Recon, role mask, fake Ghost system commands, daemon tags, and Ghost boot duplication.

- [ ] **Step 5: Implement structural-change apply path**

When a structural decision proposes a changed genome:

1. modal opens and waits;
2. on approve, create a checkpoint first;
3. if target mode is FUSE, call `compileFuseGenome` once and only then install the compiled kernel;
4. if FUSE fails, leave current genome unchanged and offer retry or STACK fallback;
5. save the mutated specimen;
6. close modal and continue chat.

- [ ] **Step 6: Implement specimen sidebar**

Show saved specimen name, last modified time, build mode, and component count. Support reopen, new specimen, and delete. Deleting one specimen must not delete others or clear `ghost_sessions`.

- [ ] **Step 7: Run focused tests and full build**

```bash
npm test -- tests/structuralDecisionModal.test.tsx tests/mrSlopTerminal.test.tsx
npm test
npm run lint
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add components/MrSlopTerminal.tsx components/ChoiceCard.tsx components/StructuralDecisionModal.tsx components/SpecimenSidebar.tsx App.tsx tests/structuralDecisionModal.test.tsx tests/mrSlopTerminal.test.tsx
git commit -m "feat: make Mr Slop conversation-first"
```

---

### Task 8: Artifact Provenance, Ghost Cleanup, and Round 1 Verification

**Files:**
- Modify: `components/MrSlopTerminal.tsx`
- Modify: `services/specimenStore.ts`
- Modify: `metadata.json`
- Delete after confirming no imports: `components/Terminal.tsx`
- Delete or replace after confirming no imports: `constants.ts`
- Remove Ghost-only code from `Sidebar.tsx` if it is no longer used; delete it if fully replaced by `SpecimenSidebar.tsx`.
- Create: `tests/artifacts.test.ts`
- Update: `README.md` if present; otherwise create it.

**Interfaces:**
- Produces: `saveArtifact(specimen, artifactInput): Specimen` or equivalent pure helper whose result records genome/component provenance.

- [ ] **Step 1: Add artifact provenance test**

Given a specimen with `tm-15` and `separated-jurisdictions`, saving an artifact must record both component IDs, current genome ID, specimen ID, and originating message ID.

- [ ] **Step 2: Implement artifact save action**

Expose a small action on model messages labeled `SAVE ARTIFACT`. It opens a lightweight kind/title choice, then stores the exact message content and provenance. This is not a structural genome change and does not require the blocking modal.

- [ ] **Step 3: Remove remaining Ghost runtime identity**

Search the runtime source for these strings and eliminate them from active app code:

```text
GHOST_FRAGMENT
PERSISTENCE NODE
OPERATIVE
NODE_771
ghost_sessions
AUTO_RECON
ROLE_MASK
```

`ghost_sessions` may remain only in comments/tests explicitly asserting that legacy storage is left untouched; it must not be the Mr. Slop active storage key.

- [ ] **Step 4: Update metadata and README**

Metadata title/description must identify Mr. Slop. README must state:

- conversation-first experimental creature builder;
- source library relationship to `merrypranxter/ai_slop`;
- local setup (`npm install`, API key, `npm run dev`);
- cost rule: one ordinary model call per turn, FUSE extra only when requested/needed;
- Round 1 exclusions: no Semantic Manifold/SRE/breeding yet.

- [ ] **Step 5: Full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Then manually verify at mobile width and desktop width:

1. opening screen says MR. SLOP and BUILD ME, not Ghost;
2. all four start routes appear;
3. Surprise Me creates a specimen;
4. I Have an Idea starts conversation without forcing a form;
5. picker can select multiple components and spawn;
6. normal send performs one model call;
7. structural popup never auto-applies;
8. specimen survives reload;
9. FUSE kernel survives reload;
10. failed model call does not corrupt genome;
11. saved artifact retains provenance;
12. no active runtime Ghost labels remain.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete Mr Slop Round 1"
```

---

## Plan Self-Review Result

- **Spec coverage:** Round 1 interaction model, neon semantics, 26 minds + extras, STACK/FUSE, versioned genetics, persistence, checkpoints, cost discipline, artifacts/provenance, error behavior, and future state sockets are all mapped to tasks.
- **Deliberate exclusions preserved:** Semantic Manifold, SRE/TOPOS, breeding, Petri Dish, full lineage UI, and cloud sync are not scheduled.
- **Type consistency:** `GenomeComponent`, `Genome`, `Specimen`, `MrSlopResponseEnvelope`, `ChoiceCardEvent`, and `StructuralDecisionEvent` are defined once in Task 1 and consumed consistently thereafter.
- **No silent destructive migration:** `ghost_sessions` remains untouched; Mr. Slop uses `mrslop_specimens_v1`.
- **Cost discipline:** one ordinary model call per turn; the only planned extra model call is explicit FUSE compilation or a separately approved expensive operation.
