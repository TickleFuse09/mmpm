import fs from "fs";
import path from "path";

const FILE_PATH = path.resolve("modpack.json");

function createEmptyModpack() {
  return {
    name: path.basename(process.cwd()),
    description: "",
    loader: null,
    mcVersion: null,
    mods: []
  };
}

function validateModpack(modpack) {
  if (!modpack || typeof modpack !== "object" || Array.isArray(modpack)) {
    throw new Error("modpack.json must contain an object");
  }

  // Required fields
  if (!Array.isArray(modpack.mods)) {
    throw new Error("modpack.json must contain a mods array");
  }

  // Optional fields with validation
  if (modpack.name !== undefined && typeof modpack.name !== "string") {
    throw new Error("modpack.json name must be a string");
  }

  if (modpack.description !== undefined && typeof modpack.description !== "string") {
    throw new Error("modpack.json description must be a string");
  }

  if (modpack.loader !== null && modpack.loader !== undefined && typeof modpack.loader !== "string") {
    throw new Error("modpack.json loader must be a string or null");
  }

  if (modpack.mcVersion !== null && modpack.mcVersion !== undefined && typeof modpack.mcVersion !== "string") {
    throw new Error("modpack.json mcVersion must be a string or null");
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
    name: modpack.name || path.basename(process.cwd()),
    description: modpack.description || "",
    loader: modpack.loader || null,
    mcVersion: modpack.mcVersion || null,
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

export function isModpackInitialized() {
  if (!fs.existsSync(FILE_PATH)) {
    return false;
  }

  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    const parsed = JSON.parse(data);
    // Check if it has the new structure (name field indicates it was created via init)
    return parsed && typeof parsed === "object" && "name" in parsed;
  } catch {
    return false;
  }
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
