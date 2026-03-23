import axios from "axios";

const BASE_URL = "https://api.modrinth.com/v2";

export async function searchMods(query) {
  try {
    const res = await axios.get(`${BASE_URL}/search`, {
      params: { query, limit: 5 },
    });
    return res.data.hits;
  } catch (err) {
    throw new Error("Failed to search mods");
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
    throw new Error("Failed to fetch versions");
  }
}

export async function getProject(projectId) {
  try {
    const res = await axios.get(`${BASE_URL}/project/${projectId}`);
      return res.data;
  } catch (err) {
      throw new Error("Failed to fetch project");
  }
}