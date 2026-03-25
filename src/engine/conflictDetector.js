import { getProjectVersions } from "../api/modrinth.js";
import { resolveProject } from "../services/modService.js";

function isMinecraftVersion(version) {
  if (typeof version !== "string") return false;
  // valid Minecraft versions: allow patterns like 1.XX, 1.XX.X, XX.X, etc.
  return /^\d+(?:\.\d+){1,2}$/.test(version);
}

export async function detectLoaderConflicts(modSlugs) {
  const loaderSets = [];

  for (const slug of modSlugs) {
    const project = await resolveProject(slug);
    const versions = await getProjectVersions(project.project_id);

    const loaders = new Set();
    const mcVersions = new Set();
    const combos = new Set();

    versions.forEach((version) => {
      version.loaders.forEach((loader) => loaders.add(loader));

      version.game_versions.forEach((mcVersion) => {
        if (!isMinecraftVersion(mcVersion)) return;

        mcVersions.add(mcVersion);

        version.loaders.forEach((loader) => {
          combos.add(`${loader}|${mcVersion}`);
        });
      });
    });

    loaderSets.push({
      mod: slug,
      loaders,
      mcVersions,
      combos,
    });
  }

  let commonCombos = new Set(loaderSets[0]?.combos || []);

  for (const entry of loaderSets.slice(1)) {
    commonCombos = new Set(
      [...commonCombos].filter((combo) => entry.combos.has(combo))
    );
  }

  const commonLoaders = new Set();
  const commonVersions = new Set();

  commonCombos.forEach((combo) => {
    const [loader, mcVersion] = combo.split("|");
    commonLoaders.add(loader);
    commonVersions.add(mcVersion);
  });

  return {
    loaderSets,
    commonLoaders,
    commonVersions,
    commonCombos,
  };
}

export async function verifyModpackConstraints(modSlugs, loader = null, mcVersion = null) {
  const loaderViolations = [];
  const mcVersionViolations = [];

  for (const slug of modSlugs) {
    const project = await resolveProject(slug);
    const versions = await getProjectVersions(project.project_id);

    const versionLoaders = new Set();
    const versionMcVersions = new Set();

    versions.forEach((version) => {
      version.loaders.forEach((l) => versionLoaders.add(l));
      version.game_versions.forEach((v) => {
        if (isMinecraftVersion(v)) {
          versionMcVersions.add(v);
        }
      });
    });

    if (loader && !versionLoaders.has(loader)) {
      loaderViolations.push({ mod: slug, loader });
    }

    if (mcVersion && !versionMcVersions.has(mcVersion)) {
      mcVersionViolations.push({ mod: slug, mcVersion });
    }
  }

  return {
    valid: loaderViolations.length === 0 && mcVersionViolations.length === 0,
    loaderViolations,
    mcVersionViolations,
  };
}
