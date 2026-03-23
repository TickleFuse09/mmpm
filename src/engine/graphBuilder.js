import { getProject } from "../api/modrinth.js";

const visited = new Set();
const projectCache = new Map();
const modCache = new Map();

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

  let mod;

  if (modCache.has(modSlug)) {
    mod = modCache.get(modSlug);
  } else {
    mod = await modService.getModDetails(modSlug);
    modCache.set(modSlug, mod);
  }

  const latest = mod.latestVersions[0];

  const node = {
    name: mod.name,
    slug: mod.slug,
    dependencies: [],
  };

  if (!latest || !latest.dependencies) return node;

  for (const dep of latest.dependencies) {
    if (!dep.project_id) continue;

    if (dep.dependency_type !== "required") continue;

    try {
      let project;

      if (projectCache.has(dep.project_id)) {
        project = projectCache.get(dep.project_id);
      } else {
        project = await getProject(dep.project_id);
        projectCache.set(dep.project_id, project);
      }

      const child = await resolveNode(modService, project.slug);

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