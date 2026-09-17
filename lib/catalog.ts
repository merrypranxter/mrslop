import { GenomeComponent } from '../types';

export const buildCatalogIndex = (library: GenomeComponent[]): string =>
  library
    .map(component => `${component.id} | ${component.name} | ${component.kind} | roles:${component.roleHints.join(',')} | ${component.description}`)
    .join('\n');

export const findComponentsByRole = (
  library: GenomeComponent[],
  role: string,
): GenomeComponent[] => {
  const target = role.trim().toLowerCase();
  return library.filter(component =>
    component.roleHints.some(hint => hint.toLowerCase() === target),
  );
};
