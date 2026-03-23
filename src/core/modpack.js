// 🔽 NEW VERSION (persistent)

import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve("modpack.json");

// load existing or create new
function loadModpack() {
  if (!fs.existsSync(FILE_PATH)) {
    return { mods: [] };
  }

  const data = fs.readFileSync(FILE_PATH, "utf-8");
  return JSON.parse(data);
}

function saveModpack(modpack) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(modpack, null, 2));
}

export function getModpack() {
  return loadModpack();
}

export function addToModpack(slug) {
  const modpack = loadModpack();

  if (!modpack.mods.includes(slug)) {
    modpack.mods.push(slug);
    saveModpack(modpack);
  }

  return modpack;
}