import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve("modpack.json");

function createEmptyModpack() {
  return { mods: [] };
}

function validateModpack(modpack) {
  if (!modpack || typeof modpack !== "object" || Array.isArray(modpack)) {
    throw new Error("modpack.json must contain an object with a mods array");
  }

  if (!Array.isArray(modpack.mods)) {
    throw new Error("modpack.json must contain a mods array");
  }

  const invalidEntry = modpack.mods.find(
    (slug) => typeof slug !== "string" || slug.trim() === ""
  );

  if (invalidEntry !== undefined) {
    throw new Error("modpack.json mods must be non-empty strings");
  }
}

function normalizeModpack(modpack) {
  return {
    mods: [...new Set(modpack.mods.map((slug) => slug.trim()))],
  };
}

function loadModpack() {
  if (!fs.existsSync(FILE_PATH)) {
    return createEmptyModpack();
  }

  let parsed;

  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    parsed = JSON.parse(data);
  } catch (err) {
    throw new Error(`Failed to read modpack.json: ${err.message}`);
  }

  validateModpack(parsed);
  return normalizeModpack(parsed);
}

function saveModpack(modpack) {
  validateModpack(modpack);

  fs.writeFileSync(FILE_PATH, `${JSON.stringify(normalizeModpack(modpack), null, 2)}\n`);
}

export function getModpack() {
  return loadModpack();
}

export function addToModpack(slug) {
  if (typeof slug !== "string" || slug.trim() === "") {
    throw new Error("Mod slug must be a non-empty string");
  }

  const normalizedSlug = slug.trim();
  const modpack = loadModpack();

  if (!modpack.mods.includes(normalizedSlug)) {
    modpack.mods.push(normalizedSlug);
    saveModpack(modpack);
  }

  return modpack;
}
