import { getProjectVersions, searchMods } from "../api/modrinth.js";

export async function resolveProject(query) {
  const searchResult = await searchMods(query);
  const results = searchResult.hits;

  if (!results.length) {
    throw new Error("No mods found");
  }

  return (
    results.find((mod) => mod.slug.toLowerCase() === query.toLowerCase()) ||
    results.find((mod) => mod.title.toLowerCase() === query.toLowerCase()) ||
    results[0]
  );
}

export async function getModDetails(query, filters = {}) {
  const mod = await resolveProject(query);

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
    const availableVersions = new Set();

    versions.forEach((v) => {
      v.loaders.forEach((l) => availableLoaders.add(l));
      v.game_versions.forEach((gv) => availableVersions.add(gv));
    });

    const loaderIssue =
      filters.loader && ![...availableLoaders].includes(filters.loader);

    const versionIssue =
      filters.mcVersion && ![...availableVersions].includes(filters.mcVersion);

    let message = "No versions found for given filters.\n";

    if (loaderIssue) {
      message += `Supported loaders: ${[...availableLoaders].join(", ")}\n`;
    }

    if (versionIssue) {
      message += `Supported Minecraft versions: ${[...availableVersions]
        .slice(0, 10)
        .join(", ")}...\n`;
    }

    throw new Error(message.trim());
  }

  const latestVersions = [...filteredVersions]
    .sort(
      (a, b) =>
        new Date(b.date_published || 0).getTime() -
        new Date(a.date_published || 0).getTime()
    )
    .slice(0, 5);

  return {
    name: mod.title,
    slug: mod.slug,
    description: mod.description,
    latestVersions: latestVersions.map((v) => ({
      version: v.name,
      loaders: v.loaders,
      gameVersions: v.game_versions,
      dependencies: v.dependencies || [],
    })),
  };
}
