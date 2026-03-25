import axios from "axios";

const BASE_URL = "https://api.modrinth.com/v2";

function formatApiError(action, err) {
  const status = err.response?.status;
  const details =
    err.response?.data?.description ||
    err.response?.data?.error ||
    err.message ||
    "Unknown error";

  const statusText = status ? ` (${status})` : "";
  return new Error(`Failed to ${action}${statusText}: ${details}`);
}

export async function searchMods(query, limit = 100, offset = 0) {
  try {
    const res = await axios.get(`${BASE_URL}/search`, {
      params: { query, limit, offset },
    });
    return {
      hits: res.data.hits,
      total_hits: res.data.total_hits,
    };
  } catch (err) {
    throw formatApiError("search mods", err);
  }
}

export async function getProjectVersions(projectId, filters = {}) {
  try {
    const res = await axios.get(`${BASE_URL}/project/${projectId}/version`, {
      params: {
        loaders: filters.loader ? [filters.loader] : undefined,
        game_versions: filters.mcVersion ? [filters.mcVersion] : undefined,
      },
    });

    return res.data;
  } catch (err) {
    throw formatApiError(`fetch versions for project ${projectId}`, err);
  }
}

export async function getProject(projectId) {
  try {
    const res = await axios.get(`${BASE_URL}/project/${projectId}`);
    return res.data;
  } catch (err) {
    throw formatApiError(`fetch project ${projectId}`, err);
  }
}
