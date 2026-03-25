import { getProjectVersions, getProject } from "../api/modrinth.js";
import { resolveProject } from "./modService.js";
import { resolveFullModpack } from "../engine/resolver.js";
import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve("modpack-lock.json");

/**
 * Get the download URL from a version object
 * @param {Object} version - Version object from Modrinth API
 * @returns {string} Download URL
 */
function getDownloadUrl(version) {
  if (!version.files || version.files.length === 0) {
    throw new Error(`No files available for version ${version.version_number}`);
  }

  // Prefer primary file, fall back to first file
  const file = version.files.find((f) => f.primary) || version.files[0];
  return file.url;
}

/**
 * Check if version is valid for lock file
 * @param {Object} version - Version object
 * @returns {boolean}
 */
function isValidLockVersion(version) {
  return (
    version.version_type === "release" &&
    Array.isArray(version.files) &&
    version.files.length > 0
  );
}

/**
 * Recursively resolve dependencies for a mod version
 * @param {string} projectId - Project ID
 * @param {string} versionId - Version ID to look up
 * @param {Object} constraints - {loader, mcVersion}
 * @param {Set} visitedProjectIds - Track visited projects to avoid circular dependencies
 * @param {Map} versionCache - Cache of fetched versions
 * @returns {Promise<Array>} Array of dependency objects
 */
async function resolveDependenciesRecursive(
  projectId,
  versionId,
  constraints,
  visitedProjectIds = new Set(),
  versionCache = new Map()
) {
  // Prevent circular dependencies
  if (visitedProjectIds.has(projectId)) {
    return [];
  }

  visitedProjectIds.add(projectId);

  try {
    // Fetch version details
    let allVersions = versionCache.get(projectId);
    if (!allVersions) {
      allVersions = await getProjectVersions(projectId);
      versionCache.set(projectId, allVersions);
    }

    const version = allVersions.find((v) => v.id === versionId);
    if (!version || !isValidLockVersion(version)) {
      return [];
    }

    const dependencies = [];
    const dependencyMap = new Map();

    if (Array.isArray(version.dependencies)) {
      for (const dep of version.dependencies) {
        // Only include required dependencies
        if (dep.dependency_type !== "required") {
          continue;
        }

        // Skip if already processed this project
        if (dependencyMap.has(dep.project_id)) {
          continue;
        }

        try {
          // Find the best version of the dependency that matches constraints
          const depVersions = versionCache.get(dep.project_id) ||
            (await getProjectVersions(dep.project_id));
          
          if (!versionCache.has(dep.project_id)) {
            versionCache.set(dep.project_id, depVersions);
          }

          // Filter valid versions that match constraints
          const validVersions = depVersions.filter((v) => {
            if (!isValidLockVersion(v)) return false;
            
            if (constraints.loader && !v.loaders.includes(constraints.loader)) {
              return false;
            }
            
            if (
              constraints.mcVersion &&
              !v.game_versions.includes(constraints.mcVersion)
            ) {
              return false;
            }

            return true;
          });

          if (validVersions.length > 0) {
            // Sort by publish date (newest first)
            const best = validVersions.sort(
              (a, b) =>
                new Date(b.date_published || 0).getTime() -
                new Date(a.date_published || 0).getTime()
            )[0];

            const depInfo = {
              project_id: dep.project_id,
              required: true,
            };

            dependencyMap.set(dep.project_id, depInfo);
            dependencies.push(depInfo);

            // Recursively resolve sub-dependencies
            const subDeps = await resolveDependenciesRecursive(
              dep.project_id,
              best.id,
              constraints,
              new Set(visitedProjectIds),
              versionCache
            );

            if (subDeps.length > 0) {
              for (const subDep of subDeps) {
                if (!dependencyMap.has(subDep.project_id)) {
                  dependencyMap.set(subDep.project_id, subDep);
                  dependencies.push(subDep);
                }
              }
            }
          }
        } catch (err) {
          // Skip dependencies that fail to resolve
          console.warn(
            `Warning: Could not resolve dependency ${dep.project_id}: ${err.message}`
          );
        }
      }
    }

    return dependencies;
  } catch (err) {
    console.warn(
      `Warning: Could not fetch version details for project ${projectId}: ${err.message}`
    );
    return [];
  }
}

/**
 * Generate a deterministic lock file
 * @param {Object} modpack - Modpack object from modpack.json
 * @returns {Promise<Object>} Lock file object
 */
export async function generateLockFile(modpack) {
  if (!modpack || !Array.isArray(modpack.mods)) {
    throw new Error("Invalid modpack object");
  }

  // Resolve the modpack to find best compatible versions
  const resolvedResult = await resolveFullModpack(modpack.mods, {
    loader: modpack.loader,
    mcVersion: modpack.mcVersion,
  });

  if (!resolvedResult) {
    throw new Error(
      "Could not resolve modpack - no compatible configuration found"
    );
  }

  const { loader, mcVersion } = resolvedResult;
  const constraints = { loader, mcVersion };

  const lockMods = [];
  const processedProjectIds = new Set();
  const versionCache = new Map();

  // Process each mod in the original modpack
  for (const slug of modpack.mods) {
    try {
      // Resolve the project
      const project = await resolveProject(slug);
      const projectId = project.project_id;

      // Skip if already processed
      if (processedProjectIds.has(projectId)) {
        continue;
      }

      processedProjectIds.add(projectId);

      // Get all versions for this project
      let versions = versionCache.get(projectId);
      if (!versions) {
        versions = await getProjectVersions(projectId);
        versionCache.set(projectId, versions);
      }

      // Filter to valid release versions
      const validVersions = versions.filter(isValidLockVersion);

      // Find best version matching constraints
      const matchingVersions = validVersions.filter((v) => {
        if (constraints.loader && !v.loaders.includes(constraints.loader)) {
          return false;
        }
        
        if (
          constraints.mcVersion &&
          !v.game_versions.includes(constraints.mcVersion)
        ) {
          return false;
        }

        return true;
      });

      if (matchingVersions.length === 0) {
        throw new Error(
          `No compatible version found for ${slug} with constraints loader=${constraints.loader}, mcVersion=${constraints.mcVersion}`
        );
      }

      // Pick best version (newest by publish date)
      const bestVersion = matchingVersions.sort(
        (a, b) =>
          new Date(b.date_published || 0).getTime() -
          new Date(a.date_published || 0).getTime()
      )[0];

      // Resolve dependencies
      const dependencies = await resolveDependenciesRecursive(
        projectId,
        bestVersion.id,
        constraints,
        new Set(),
        versionCache
      );

      const modEntry = {
        slug,
        project_id: projectId,
        version_id: bestVersion.id,
        version_number: bestVersion.version_number,
        download_url: getDownloadUrl(bestVersion),
        dependencies,
      };

      lockMods.push(modEntry);
    } catch (err) {
      throw new Error(`Failed to resolve mod "${slug}": ${err.message}`);
    }
  }

  // Now process all discovered dependencies to get their full details
  const allLockMods = [...lockMods];
  const allProcessedIds = new Set(processedProjectIds);

  // Collect all unique dependency project IDs from current mods
  const depProjectIds = new Set();
  lockMods.forEach((mod) => {
    mod.dependencies.forEach((dep) => {
      if (!allProcessedIds.has(dep.project_id)) {
        depProjectIds.add(dep.project_id);
      }
    });
  });

  // Add full entries for each dependency
  for (const depProjectId of depProjectIds) {
    try {
      allProcessedIds.add(depProjectId);

      // Get versions for dependency
      let depVersions = versionCache.get(depProjectId);
      if (!depVersions) {
        depVersions = await getProjectVersions(depProjectId);
        versionCache.set(depProjectId, depVersions);
      }

      // Find best matching version
      const validDepVersions = depVersions.filter(isValidLockVersion);
      const matchingDepVersions = validDepVersions.filter((v) => {
        if (constraints.loader && !v.loaders.includes(constraints.loader)) {
          return false;
        }
        
        if (
          constraints.mcVersion &&
          !v.game_versions.includes(constraints.mcVersion)
        ) {
          return false;
        }

        return true;
      });

      if (matchingDepVersions.length > 0) {
        const bestDepVersion = matchingDepVersions.sort(
          (a, b) =>
            new Date(b.date_published || 0).getTime() -
            new Date(a.date_published || 0).getTime()
        )[0];

        // Get project slug for display
        const depProject = await getProject(depProjectId);

        // Resolve dependencies of this dependency
        const subDependencies = await resolveDependenciesRecursive(
          depProjectId,
          bestDepVersion.id,
          constraints,
          new Set(allProcessedIds),
          versionCache
        );

        const depEntry = {
          slug: depProject.slug,
          project_id: depProjectId,
          version_id: bestDepVersion.id,
          version_number: bestDepVersion.version_number,
          download_url: getDownloadUrl(bestDepVersion),
          dependencies: subDependencies,
        };

        allLockMods.push(depEntry);
      }
    } catch (err) {
      console.warn(
        `Warning: Could not add full entry for dependency ${depProjectId}: ${err.message}`
      );
    }
  }

  const lockFile = {
    loader,
    mcVersion,
    mods: allLockMods,
  };

  return lockFile;
}

/**
 * Save lock file to disk
 * @param {Object} lockFile - Lock file object to save
 */
export function saveLockFile(lockFile) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(lockFile, null, 2));
  return FILE_PATH;
}

/**
 * Load existing lock file
 * @returns {Object|null} Lock file object or null if doesn't exist
 */
export function loadLockFile() {
  if (!fs.existsSync(FILE_PATH)) {
    return null;
  }

  const content = fs.readFileSync(FILE_PATH, "utf-8");
  return JSON.parse(content);
}
