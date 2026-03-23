import { searchMods, getProjectVersions } from "../api/modrinth.js";

export async function getModDetails(query) {
  const results = await searchMods(query);

  if (!results.length) {
    throw new Error("No mods found");
  }

  const mod = results[0];

  const versions = await getProjectVersions(mod.project_id);

  return {
    name: mod.title,
    slug: mod.slug,
    description: mod.description,
    latestVersions: versions.slice(0, 5).map((v) => ({
      version: v.name,
      loaders: v.loaders,
      gameVersions: v.game_versions,
      dependencies: v.dependencies,
    })),
  };
}