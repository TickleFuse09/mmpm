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
  const cacheKey = `${modSlug}|${filters.loader || ""}|${filters.mcVersion || ""}`;

  if (visited.has(cacheKey)) {
    return { name: modSlug, circular: true };
  }

  visited.add(cacheKey);

  try {
    let mod;

    if (modCache.has(cacheKey)) {
      mod = modCache.get(cacheKey);
    } else {
      mod = await modService.getModDetails(modSlug, filters);
      modCache.set(cacheKey, mod);
    }

    const latest = mod.latestVersions[0];

    const node = {
      name: mod.name,
      slug: mod.slug,
      dependencies: [],
    };

    if (!latest || !latest.dependencies) {
      return node;
    }

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
  } finally {
    visited.delete(cacheKey);
  }
}
