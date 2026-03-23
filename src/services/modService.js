import { searchMods, getProjectVersions } from "../api/modrinth.js";

export async function getModDetails(query, filters = {}) {
  const results = await searchMods(query);

  if (!results.length) {
    throw new Error("No mods found");
  }

  const mod = results[0];

  const versions = await getProjectVersions(mod.project_id, filters);

  const filteredVersions = versions.filter((v) => {
    const loaderMatch = filters.loader
      ? v.loaders.includes(filters.loader)
      : true;

    const versionMatch = filters.mcVersion
      ? v.game_versions.includes(filters.mcVersion)
      : true;

    return loaderMatch && versionMatch;
  });

  if (filteredVersions.length === 0) {
    const availableLoaders = new Set();

    versions.forEach((v) => {
      v.loaders.forEach((l) => availableLoaders.add(l));
    });

    throw new Error(
      `No versions found for given filters.\nSupported loaders: ${[
        ...availableLoaders,
      ].join(", ")}`
    );
  }

  return {
    name: mod.title,
    slug: mod.slug,
    description: mod.description,
    latestVersions: filteredVersions.slice(0, 5).map((v) => ({
      version: v.name,
      loaders: v.loaders,
      gameVersions: v.game_versions,
      dependencies: v.dependencies,
    })),
  };
}