const visited = new Set();

export async function buildDependencyGraph(modService, modSlug) {
  visited.clear();

  const root = await resolveNode(modService, modSlug);

  return root;
}

async function resolveNode(modService, modSlug) {
  if (visited.has(modSlug)) {
    return { name: modSlug, circular: true };
  }

  visited.add(modSlug);

  const mod = await modService.getModDetails(modSlug);

  const latest = mod.latestVersions[0];

  const node = {
    name: mod.name,
    slug: mod.slug,
    dependencies: [],
  };

  if (!latest || !latest.dependencies) return node;

  for (const dep of latest.dependencies) {
    if (!dep.project_id) continue;

    try {
      const child = await resolveNode(modService, dep.project_id);
      node.dependencies.push(child);
    } catch (err) {
      node.dependencies.push({
        name: dep.project_id,
        error: true,
      });
    }
  }

  return node;
}