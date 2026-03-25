import chalk from "chalk";
import { getProjectVersions, searchMods } from "../api/modrinth.js";

const MAX_RESULTS_PER_PAGE = 5;

// Cache for version data to avoid repeated API calls
const versionCache = new Map();

/**
 * Fetch and cache project versions
 * @param {string} projectId
 * @returns {Promise<Array>} versions array
 */
async function getAndCacheVersions(projectId) {
  if (versionCache.has(projectId)) {
    return versionCache.get(projectId);
  }

  const versions = await getProjectVersions(projectId);
  versionCache.set(projectId, versions);
  return versions;
}

/**
 * Extract unique loaders and MC versions from versions array
 * @param {Array} versions
 * @returns {Object} {loaders: Set, gameVersions: Set}
 */
function isMinecraftVersion(version) {
  if (typeof version !== "string") return false;
  return /^1(?:\.\d+){1,2}$/.test(version);
}

function aggregateVersionData(versions) {
  const loaders = new Set();
  const gameVersions = new Set();

  versions.forEach((version) => {
    version.loaders?.forEach((loader) => loaders.add(loader));
    version.game_versions
      ?.filter(isMinecraftVersion)
      .forEach((gv) => gameVersions.add(gv));
  });

  return {
    loaders: Array.from(loaders).sort(),
    gameVersions: Array.from(gameVersions)
      .sort((a, b) => b.localeCompare(a)) // Sort descending (1.20.1 before 1.19.4)
      .slice(0, 5), // Limit to top 5 versions
  };
}

/**
 * Truncate text to approximate character limit
 * @param {string} text
 * @param {number} limit (approximate, respects word boundaries)
 * @returns {string}
 */
function truncateText(text, limit = 100) {
  if (!text || text.length <= limit) return text;

  let truncated = text.substring(0, limit);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 0) {
    truncated = truncated.substring(0, lastSpace);
  }

  return truncated + "...";
}

/**
 * Format a single search result for display
 * @param {Object} result
 * @param {number} index (1-based)
 * @returns {Promise<string>}
 */
async function formatResult(result, index) {
  const versionData = await getAndCacheVersions(result.project_id);
  const { loaders, gameVersions } = aggregateVersionData(versionData);

  const authors = result.author ? chalk.cyan(result.author) : chalk.dim("Unknown");

  const output = [
    chalk.bold.cyan(`[${index}] ${result.title}`),
    chalk.gray(`Author: ${authors}`),
    chalk.white(`Desc: ${truncateText(result.description)}`),
    chalk.yellow(`Type: ${result.project_type}`),
    chalk.blue(`ID: ${result.project_id}`),
    chalk.green(`Loaders: ${loaders.length > 0 ? loaders.join(", ") : chalk.dim("N/A")}`),
    chalk.magenta(`MC Versions: ${gameVersions.length > 0 ? gameVersions.join(", ") : chalk.dim("N/A")}`),
    "",
  ];

  return output.join("\n");
}

/**
 * Perform paginated search with caching
 * @param {string} query
 * @returns {Promise<Object>} {allResults, totalHits}
 */
export async function performSearch(query) {
  try {
    const searchResult = await searchMods(query, 100, 0);

    return {
      allResults: searchResult.hits,
      totalHits: searchResult.total_hits,
    };
  } catch (err) {
    throw new Error(`Search failed: ${err.message}`);
  }
}

/**
 * Get paginated results with formatted output
 * @param {Array} allResults
 * @param {number} pageNumber (1-based)
 * @returns {Promise<Object>} {results: string, pageInfo: Object}
 */
export async function getPaginatedResults(allResults, pageNumber = 1) {
  const totalPages = Math.ceil(allResults.length / MAX_RESULTS_PER_PAGE);

  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(`Invalid page number. Valid range: 1-${totalPages}`);
  }

  const startIndex = (pageNumber - 1) * MAX_RESULTS_PER_PAGE;
  const endIndex = startIndex + MAX_RESULTS_PER_PAGE;
  const pageResults = allResults.slice(startIndex, endIndex);

  const formatted = [];
  for (let i = 0; i < pageResults.length; i++) {
    const displayIndex = startIndex + i + 1;
    const formatted_item = await formatResult(pageResults[i], displayIndex);
    formatted.push(formatted_item);
  }

  return {
    results: formatted.join("\n"),
    pageInfo: {
      currentPage: pageNumber,
      totalPages,
      startIndex: startIndex + 1,
      endIndex: endIndex,
      totalResults: allResults.length,
    },
  };
}

/**
 * Clear the version cache (useful after session ends)
 */
export function clearVersionCache() {
  versionCache.clear();
}
