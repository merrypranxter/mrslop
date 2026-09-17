import type { Genome, GenomeComponent, GenomeMode } from '../types';

const freshId = (): string => crypto.randomUUID();

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
    return {
      ...source,
      tags: [...source.tags],
      roleHints: [...source.roleHints],
      order,
    };
  });

  return {
    id: freshId(),
    mode,
    components,
    customSeed: customSeed?.trim() || undefined,
  };
};

export const cloneGenome = (genome: Genome): Genome => ({
  ...genome,
  id: freshId(),
  components: genome.components.map(component => ({
    ...component,
    tags: [...component.tags],
    roleHints: [...component.roleHints],
  })),
});

export const estimateGenomeChars = (genome: Genome): number =>
  genome.components
    .filter(component => component.enabled)
    .reduce((sum, component) => sum + component.prompt.length, 0) +
  (genome.customSeed?.length || 0);

const pickOne = (
  candidates: GenomeComponent[],
  selected: Set<string>,
  rng: () => number,
): string | undefined => {
  const available = candidates.filter(component => component.enabled && !selected.has(component.id));
  if (available.length === 0) return undefined;
  const index = Math.min(available.length - 1, Math.floor(Math.max(0, rng()) * available.length));
  return available[index]?.id;
};

const hasAnyRole = (component: GenomeComponent, roles: string[]): boolean =>
  roles.some(role => component.roleHints.includes(role));

export const selectSurpriseComponents = (
  library: GenomeComponent[],
  rng: () => number = Math.random,
): string[] => {
  const selected = new Set<string>();

  const groups: string[][] = [
    ['ontology', 'cognition'],
    ['selection', 'perception', 'salience'],
    ['structure', 'constraint'],
  ];

  for (const roles of groups) {
    const id = pickOne(library.filter(component => hasAnyRole(component, roles)), selected, rng);
    if (id) selected.add(id);
  }

  const regulator = pickOne(
    library.filter(component => component.kind === 'regulator' || hasAnyRole(component, ['regulator'])),
    selected,
    rng,
  );
  if (regulator) selected.add(regulator);

  if (selected.size < 3) {
    const fallback = library.filter(component => component.enabled && !selected.has(component.id));
    while (selected.size < 3 && fallback.length > 0) {
      const id = pickOne(fallback, selected, rng);
      if (!id) break;
      selected.add(id);
    }
  }

  return [...selected];
};
