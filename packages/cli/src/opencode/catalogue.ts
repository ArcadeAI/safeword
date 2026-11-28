import type { CanonicalCommandWrapper } from '../host-contract/catalogue.js';

export function openCodeCommandWorkflow(command: CanonicalCommandWrapper): string {
  const [name] = command.skillPath.split('/', 1);
  if (name === undefined) throw new Error(`OpenCode command ${command.name} has no skill path`);
  return name;
}

export function validateOpenCodeCatalogueReferences(
  knownSkills: ReadonlySet<string>,
  commands: readonly CanonicalCommandWrapper[],
  agents: readonly { readonly skill: string }[],
): void {
  for (const reference of [
    ...commands.map(command => openCodeCommandWorkflow(command)),
    ...agents.map(agent => agent.skill),
  ]) {
    if (!knownSkills.has(reference)) {
      throw new Error(`OpenCode catalogue references unknown skill: ${reference}`);
    }
  }
}
