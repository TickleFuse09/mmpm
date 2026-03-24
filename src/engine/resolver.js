import { getProjectVersions } from "../api/modrinth.js";
import { resolveProject } from "../services/modService.js";

export function resolveBestCombination(conflictResult) {
  const { commonCombos } = conflictResult;

  if (!commonCombos || commonCombos.size === 0) {
    return null;
  }

  const [bestCombo] = [...commonCombos]
    .map((combo) => {
      const [loader, mcVersion] = combo.split("|");
      return { loader, mcVersion };
    })
    .sort((a, b) => compareReleaseVersions(b.mcVersion, a.mcVersion));

  return bestCombo;
}

export async function resolveFullModpack(modSlugs) {
  const modData = [];

  for (const slug of modSlugs) {
    const project = await resolveProject(slug);
    const versions = await getProjectVersions(project.project_id);

    modData.push({
      slug,
      versions,
    });
  }

  const comboMap = new Map();

  modData.forEach(({ versions }) => {
    const seen = new Set();

    versions.forEach((version) => {
      version.loaders.forEach((loader) => {
        version.game_versions.forEach((mcVersion) => {
          const key = `${loader}|${mcVersion}`;

          if (!seen.has(key)) {
            comboMap.set(key, (comboMap.get(key) || 0) + 1);
            seen.add(key);
          }
        });
      });
    });
  });

  const validCombos = [];

  for (const [key, count] of comboMap.entries()) {
    if (count !== modData.length) continue;

    const [loader, mcVersion] = key.split("|");
    const isValid = modData.every(({ versions }) =>
      versions.some(
        (version) =>
          version.loaders.includes(loader) &&
          version.game_versions.includes(mcVersion) &&
          version.files &&
          version.files.length > 0
      )
    );

    if (isValid) {
      validCombos.push({ loader, mcVersion });
    }
  }

  if (validCombos.length === 0) {
    return null;
  }

  validCombos.sort((a, b) => compareReleaseVersions(b.mcVersion, a.mcVersion));

  const best = validCombos[0];
  const resolvedMods = {};

  for (const { slug, versions } of modData) {
    const candidates = versions.filter(
      (version) =>
        version.loaders.includes(best.loader) &&
        version.game_versions.includes(best.mcVersion)
    );

    const match = candidates.sort(compareProjectVersions)[0];

    resolvedMods[slug] = match?.name || "No matching version";
  }

  return {
    loader: best.loader,
    mcVersion: best.mcVersion,
    mods: resolvedMods,
  };
}

function compareReleaseVersions(a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareProjectVersions(a, b) {
  const publishedDiff =
    new Date(b.date_published || 0).getTime() -
    new Date(a.date_published || 0).getTime();

  if (publishedDiff !== 0) {
    return publishedDiff;
  }

  return (b.version_number || b.name || "").localeCompare(
    a.version_number || a.name || "",
    undefined,
    { numeric: true, sensitivity: "base" }
  );
}
