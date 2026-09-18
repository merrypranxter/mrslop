import type {
  ComponentKind,
  GeneticsComponentDecision,
  GeneticsGenomeReceipt,
  GenomeComponent,
  Specimen,
} from '../types';
import { componentFunctionalFingerprint } from './breedingState';
import {
  canonicalParentIds,
  deterministicUniform,
} from './geneticsRandom';

const ROLES: ComponentKind[] = ['mind', 'operator', 'regulator', 'seed', 'media', 'custom'];

interface InternalCandidate {
  component: GenomeComponent;
  fingerprint: string;
  role: ComponentKind;
  sourceParentIds: string[];
  sourceParentIndexes: number[];
  status: GeneticsComponentDecision['status'];
  weight: number;
  uniform: number;
  selectionKey: number;
  selected: boolean;
  balanceRepair?: 'removed' | 'added';
  childOrderMetric?: number;
}

export interface GenomeCrossoverResult {
  components: GenomeComponent[];
  receipt: GeneticsGenomeReceipt;
}

const cloneComponent = (component: GenomeComponent): GenomeComponent => ({
  ...component,
  tags: [...component.tags],
  roleHints: [...component.roleHints],
});

const stableCandidateKey = (candidate: Pick<InternalCandidate, 'role' | 'component' | 'fingerprint'>): string =>
  `${candidate.role}:${candidate.component.id}:${candidate.fingerprint}`;

const compareCandidates = (left: InternalCandidate, right: InternalCandidate): number =>
  left.selectionKey - right.selectionKey ||
  stableCandidateKey(left).localeCompare(stableCandidateKey(right));

const canonicalParents = (a: Specimen, b: Specimen): [Specimen, Specimen] => {
  if (a.id === b.id) throw new Error('BREEDING_REQUIRES_DISTINCT_PARENTS');
  const ids = canonicalParentIds(a.id, b.id);
  return a.id === ids[0] ? [a, b] : [b, a];
};

const enabledByOrder = (specimen: Specimen): GenomeComponent[] =>
  specimen.currentGenome.components
    .filter(component => component.enabled)
    .map(cloneComponent)
    .sort((left, right) =>
      left.order - right.order ||
      left.id.localeCompare(right.id) ||
      componentFunctionalFingerprint(left).localeCompare(componentFunctionalFingerprint(right)));

const roleCountRecord = (
  left: GenomeComponent[],
  right: GenomeComponent[],
): Record<ComponentKind, [number, number]> =>
  Object.fromEntries(ROLES.map(role => [
    role,
    [
      left.filter(component => component.kind === role).length,
      right.filter(component => component.kind === role).length,
    ] as [number, number],
  ])) as Record<ComponentKind, [number, number]>;

const buildCandidates = (
  parents: [Specimen, Specimen],
  enabled: [GenomeComponent[], GenomeComponent[]],
  seed: string,
): InternalCandidate[] => {
  const byIdentity = new Map<string, Array<{
    component: GenomeComponent;
    fingerprint: string;
    parentIndex: number;
  }>>();

  enabled.forEach((components, parentIndex) => {
    const seen = new Set<string>();
    for (const component of components) {
      const fingerprint = componentFunctionalFingerprint(component);
      const duplicateKey = `${component.id}:${fingerprint}`;
      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      const entries = byIdentity.get(component.id) ?? [];
      entries.push({ component, fingerprint, parentIndex });
      byIdentity.set(component.id, entries);
    }
  });

  const candidates: InternalCandidate[] = [];

  for (const [componentId, entries] of [...byIdentity.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const byFingerprint = new Map<string, typeof entries>();
    for (const entry of entries) {
      const group = byFingerprint.get(entry.fingerprint) ?? [];
      group.push(entry);
      byFingerprint.set(entry.fingerprint, group);
    }

    const divergent = byFingerprint.size > 1;

    for (const [fingerprint, group] of [...byFingerprint.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const parentIndexes = [...new Set(group.map(item => item.parentIndex))].sort();
      const sourceParentIds = parentIndexes.map(index => parents[index].id);
      const shared = parentIndexes.length === 2 && !divergent;
      const status: InternalCandidate['status'] = divergent
        ? 'divergent-allele'
        : shared
          ? 'shared'
          : 'unique';
      const weight = shared ? 2 : 1;
      const representative = [...group].sort((a, b) => a.parentIndex - b.parentIndex)[0];
      const role = representative.component.kind;
      const key = `${role}:${componentId}:${fingerprint}`;
      const uniform = deterministicUniform(seed, 'component-selection', key);

      candidates.push({
        component: cloneComponent(representative.component),
        fingerprint,
        role,
        sourceParentIds,
        sourceParentIndexes: parentIndexes,
        status,
        weight,
        uniform,
        selectionKey: -Math.log(uniform) / weight,
        selected: false,
      });
    }
  }

  return candidates.sort((left, right) =>
    ROLES.indexOf(left.role) - ROLES.indexOf(right.role) ||
    left.component.id.localeCompare(right.component.id) ||
    left.fingerprint.localeCompare(right.fingerprint));
};

const targetGenomeSize = (
  leftCount: number,
  rightCount: number,
  seed: string,
  pairKey: string,
): { rawMean: number; targetSize: number; roundingRoll?: number } => {
  const rawMean = (leftCount + rightCount) / 2;
  if (Number.isInteger(rawMean)) return { rawMean, targetSize: rawMean };

  const roundingRoll = deterministicUniform(seed, 'genome-size-rounding', pairKey);
  return {
    rawMean,
    targetSize: roundingRoll < 0.5 ? Math.floor(rawMean) : Math.ceil(rawMean),
    roundingRoll,
  };
};

const calculateRoleQuotas = (
  counts: Record<ComponentKind, [number, number]>,
  targetSize: number,
  candidates: InternalCandidate[],
  seed: string,
): {
  quotas: Record<ComponentKind, number>;
  redistributedSlots: GeneticsGenomeReceipt['redistributedSlots'];
} => {
  const quotas = Object.fromEntries(ROLES.map(role => {
    const [a, b] = counts[role];
    return [role, Math.floor((a + b) / 2)];
  })) as Record<ComponentKind, number>;

  let needed = targetSize - ROLES.reduce((sum, role) => sum + quotas[role], 0);
  const fractionalRoles = ROLES
    .filter(role => {
      const [a, b] = counts[role];
      return ((a + b) / 2) % 1 !== 0;
    })
    .sort((left, right) =>
      deterministicUniform(seed, 'role-quota', left) -
        deterministicUniform(seed, 'role-quota', right) ||
      left.localeCompare(right));

  for (const role of fractionalRoles) {
    if (needed <= 0) break;
    quotas[role] += 1;
    needed -= 1;
  }

  const availability = Object.fromEntries(ROLES.map(role => [
    role,
    new Set(candidates.filter(candidate => candidate.role === role).map(candidate => candidate.component.id)).size,
  ])) as Record<ComponentKind, number>;

  const redistributedSlots: GeneticsGenomeReceipt['redistributedSlots'] = [];

  for (const role of ROLES) {
    const deficit = Math.max(0, quotas[role] - availability[role]);
    if (deficit === 0) continue;
    quotas[role] -= deficit;

    for (let unit = 0; unit < deficit; unit += 1) {
      const recipients = ROLES
        .filter(candidateRole => availability[candidateRole] > quotas[candidateRole])
        .sort((left, right) =>
          deterministicUniform(seed, 'role-redistribution', `${role}->${left}:${unit}`) -
            deterministicUniform(seed, 'role-redistribution', `${role}->${right}:${unit}`) ||
          left.localeCompare(right));

      const recipient = recipients[0];
      if (!recipient) break;
      quotas[recipient] += 1;
      redistributedSlots.push({ fromRole: role, toRole: recipient, count: 1 });
    }
  }

  return { quotas, redistributedSlots };
};

const selectByQuota = (
  candidates: InternalCandidate[],
  quotas: Record<ComponentKind, number>,
): void => {
  const selectedIds = new Set<string>();

  for (const role of ROLES) {
    const ordered = candidates
      .filter(candidate => candidate.role === role)
      .sort(compareCandidates);

    let selectedForRole = 0;
    for (const candidate of ordered) {
      if (selectedForRole >= quotas[role]) break;
      if (selectedIds.has(candidate.component.id)) continue;
      candidate.selected = true;
      selectedIds.add(candidate.component.id);
      selectedForRole += 1;
    }
  }
};

const contributionCounts = (candidates: InternalCandidate[]): [number, number] => {
  const counts: [number, number] = [0, 0];

  for (const candidate of candidates) {
    if (!candidate.selected || candidate.sourceParentIndexes.length !== 1) continue;
    counts[candidate.sourceParentIndexes[0]] += 1;
  }

  return counts;
};

const repairParentalBalance = (
  candidates: InternalCandidate[],
): {
  initial: [number, number];
  final: [number, number];
  note?: string;
} => {
  const initial = contributionCounts(candidates);
  let current = [...initial] as [number, number];

  while (Math.abs(current[0] - current[1]) > 1) {
    const over = current[0] > current[1] ? 0 : 1;
    const under = over === 0 ? 1 : 0;

    const selectedIds = new Set(
      candidates.filter(candidate => candidate.selected).map(candidate => candidate.component.id),
    );

    const removable = candidates
      .filter(candidate =>
        candidate.selected &&
        candidate.sourceParentIndexes.length === 1 &&
        candidate.sourceParentIndexes[0] === over)
      .sort((left, right) =>
        right.selectionKey - left.selectionKey ||
        stableCandidateKey(left).localeCompare(stableCandidateKey(right)));

    let swap: { remove: InternalCandidate; add: InternalCandidate } | undefined;

    for (const remove of removable) {
      const replacements = candidates
        .filter(candidate =>
          !candidate.selected &&
          candidate.role === remove.role &&
          candidate.sourceParentIndexes.length === 1 &&
          candidate.sourceParentIndexes[0] === under &&
          (
            candidate.component.id === remove.component.id ||
            !selectedIds.has(candidate.component.id)
          ))
        .sort(compareCandidates);

      if (replacements[0]) {
        swap = { remove, add: replacements[0] };
        break;
      }
    }

    if (!swap) {
      return {
        initial,
        final: current,
        note: 'Exact parental balance was not possible without violating the selected role structure.',
      };
    }

    swap.remove.selected = false;
    swap.remove.balanceRepair = 'removed';
    swap.add.selected = true;
    swap.add.balanceRepair = 'added';
    current = contributionCounts(candidates);
  }

  return { initial, final: current };
};

const normalizedPositions = (
  parent: Specimen,
): Map<string, number> => {
  const enabled = enabledByOrder(parent);
  const denominator = Math.max(1, enabled.length - 1);
  const result = new Map<string, number>();

  enabled.forEach((component, index) => {
    const fingerprint = componentFunctionalFingerprint(component);
    result.set(`${component.id}:${fingerprint}`, index / denominator);
  });

  return result;
};

const orderChildComponents = (
  candidates: InternalCandidate[],
  parents: [Specimen, Specimen],
  seed: string,
): GenomeComponent[] => {
  const positions = parents.map(normalizedPositions) as [Map<string, number>, Map<string, number>];

  const selected = candidates.filter(candidate => candidate.selected);

  for (const candidate of selected) {
    const lookupKey = `${candidate.component.id}:${candidate.fingerprint}`;
    const sourcePositions = candidate.sourceParentIndexes
      .map(index => positions[index].get(lookupKey))
      .filter((value): value is number => value !== undefined);

    candidate.childOrderMetric = sourcePositions.length > 0
      ? sourcePositions.reduce((sum, value) => sum + value, 0) / sourcePositions.length
      : 0;
  }

  return selected
    .sort((left, right) =>
      (left.childOrderMetric ?? 0) - (right.childOrderMetric ?? 0) ||
      deterministicUniform(seed, 'child-order', stableCandidateKey(left)) -
        deterministicUniform(seed, 'child-order', stableCandidateKey(right)) ||
      stableCandidateKey(left).localeCompare(stableCandidateKey(right)))
    .map((candidate, order) => ({
      ...cloneComponent(candidate.component),
      enabled: true,
      order,
    }));
};

const receiptCandidates = (candidates: InternalCandidate[]): GeneticsComponentDecision[] =>
  candidates.map(candidate => ({
    fingerprint: candidate.fingerprint,
    componentId: candidate.component.id,
    role: candidate.role,
    sourceParentIds: [...candidate.sourceParentIds],
    status: candidate.status,
    weight: candidate.weight,
    uniform: candidate.uniform,
    selectionKey: candidate.selectionKey,
    selected: candidate.selected,
    ...(candidate.balanceRepair ? { balanceRepair: candidate.balanceRepair } : {}),
    ...(candidate.childOrderMetric !== undefined
      ? { childOrderMetric: candidate.childOrderMetric }
      : {}),
  }));

export const crossoverGenome = (
  parentA: Specimen,
  parentB: Specimen,
  seed: string,
): GenomeCrossoverResult => {
  const parents = canonicalParents(parentA, parentB);
  const enabled = [enabledByOrder(parents[0]), enabledByOrder(parents[1])] as [
    GenomeComponent[],
    GenomeComponent[],
  ];
  const pairKey = parents.map(parent => parent.id).join('|');
  const target = targetGenomeSize(enabled[0].length, enabled[1].length, seed, pairKey);
  const roleCounts = roleCountRecord(enabled[0], enabled[1]);
  const candidates = buildCandidates(parents, enabled, seed);
  const { quotas, redistributedSlots } = calculateRoleQuotas(
    roleCounts,
    target.targetSize,
    candidates,
    seed,
  );

  selectByQuota(candidates, quotas);
  const balance = repairParentalBalance(candidates);
  const components = orderChildComponents(candidates, parents, seed);

  return {
    components,
    receipt: {
      parentEnabledCounts: [enabled[0].length, enabled[1].length],
      rawMean: target.rawMean,
      ...(target.roundingRoll !== undefined ? { roundingRoll: target.roundingRoll } : {}),
      targetSize: target.targetSize,
      roleCounts,
      roleQuotas: quotas,
      redistributedSlots,
      candidates: receiptCandidates(candidates),
      initialUniqueContribution: balance.initial,
      finalUniqueContribution: balance.final,
      ...(balance.note ? { balanceNote: balance.note } : {}),
    },
  };
};
