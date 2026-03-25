import { getProjectVersions } from "../api/modrinth.js";
import { resolveProject } from "../services/modService.js";

const DEFAULT_CONSTRAINTS = {
  loader: null,
  mcVersion: null,
};

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

function isMinecraftVersion(version) {
  if (typeof version !== "string") return false;
  // valid pure Minecraft versions (1.XX or 1.XX.X), reject loader versions like 26.1.
  return /^1(?:\.\d+){1,2}$/.test(version);
}

function getStableVersions(versions) {
  return versions.filter(
    (version) =>
      version.version_type === "release" &&
      Array.isArray(version.files) &&
      version.files.length > 0
  );
}

function matchingGameVersions(version) {
  return (version.game_versions || []).filter(isMinecraftVersion);
}

function matchesConstraints(version, constraints) {
  if (!constraints) {
    return true;
  }

  const { loader, mcVersion } = constraints;

  if (loader && !version.loaders.includes(loader)) {
    return false;
  }

  if (mcVersion && !version.game_versions.includes(mcVersion)) {
    return false;
  }

  return true;
}

function pickBestVersion(versions) {
  return versions
    .slice()
    .sort(compareProjectVersions)[0];
}

export async function resolveFullModpack(modSlugs, constraints = DEFAULT_CONSTRAINTS) {
  const normalizedConstraints = {
    loader: constraints?.loader || null,
    mcVersion: constraints?.mcVersion || null,
  };

  const modData = [];

  for (const slug of modSlugs) {
    const project = await resolveProject(slug);
    const versions = getStableVersions(
      await getProjectVersions(project.project_id)
    );

    const normalizedVersions = versions.map((version) => ({
      ...version,
      game_versions: matchingGameVersions(version),
    }));

    const matchingVersions = normalizedVersions.filter((version) =>
      matchesConstraints(version, normalizedConstraints)
    );

    modData.push({ slug, versions: matchingVersions });
  }

  // Strict mode: both generator values set
  if (normalizedConstraints.loader && normalizedConstraints.mcVersion) {
    const resolvedMods = {};

    for (const { slug, versions } of modData) {
      const best = pickBestVersion(versions);

      if (!best) {
        return null;
      }

      resolvedMods[slug] = best.name || best.version_number || "Unknown";
    }

    return {
      loader: normalizedConstraints.loader,
      mcVersion: normalizedConstraints.mcVersion,
      mods: resolvedMods,
    };
  }

  // Flexible mode (including partial constraints + no constraints)
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
          version.game_versions.includes(mcVersion)
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

    const match = pickBestVersion(candidates);
    resolvedMods[slug] = match?.name || match?.version_number || "No matching version";
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
