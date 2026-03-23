import { getProject } from "../api/modrinth.js";

const visited = new Set();
const projectCache = new Map();
const modCache = new Map();

export async function buildDependencyGraph(modService, modSlug, filters = {}) {
  visited.clear();

  const root = await resolveNode(modService, modSlug, filters);

  return root;
}

async function resolveNode(modService, modSlug, filters) {
  if (visited.has(modSlug)) {
    return { name: modSlug, circular: true };
  }

  visited.add(modSlug);

  let mod;

  if (modCache.has(modSlug)) {
    mod = modCache.get(modSlug);
  } else {
    mod = await modService.getModDetails(modSlug, filters);
    modCache.set(modSlug, mod);
  }

  const latest = mod.latestVersions[0];

  const node = {
    name: mod.name,
    slug: mod.slug,
    dependencies: [],
  };

  if (!latest || !latest.dependencies) return node;

  const dependencyPromises = latest.dependencies
    .filter((dep) => dep.project_id && dep.dependency_type === "required")
    .map(async (dep) => {
      try {
        let project;

        if (projectCache.has(dep.project_id)) {
          project = projectCache.get(dep.project_id);
        } else {
          project = await getProject(dep.project_id);
          projectCache.set(dep.project_id, project);
        }

        return await resolveNode(modService, project.slug, filters);
      } catch (err) {
        return {
          name: dep.project_id,
          error: true,
        };
      }
    });

  node.dependencies = await Promise.all(dependencyPromises);

  return node;
}