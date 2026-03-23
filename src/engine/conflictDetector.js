import { getProjectVersions, getProject, searchMods } from "../api/modrinth.js";

// 🔥 Extract loaders per mod
export async function detectLoaderConflicts(modSlugs) {
  const loaderSets = [];

  for (const slug of modSlugs) {
    const results = await searchMods(slug);
    const projectId = results[0]?.project_id;

    const versions = await getProjectVersions(projectId);

    const loaders = new Set();

    versions.forEach((v) => {
      v.loaders.forEach((l) => loaders.add(l));
    });

    loaderSets.push({
      mod: slug,
      loaders,
    });
  }

  // 🔥 find intersection
  let commonLoaders = new Set(loaderSets[0]?.loaders || []);

  for (const entry of loaderSets.slice(1)) {
    commonLoaders = new Set(
      [...commonLoaders].filter((l) => entry.loaders.has(l))
    );
  }

  return {
    loaderSets,
    commonLoaders,
  };
}