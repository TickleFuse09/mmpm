import fs from "fs";
import path from "path";
import { createInterface } from "readline";

const VALID_LOADERS = ["fabric", "forge", "neoforge", "quilt"];

function getCurrentFolderName() {
  return path.basename(process.cwd());
}

function validateLoader(loader) {
  if (!loader) return null;
  const normalized = loader.toLowerCase().trim();
  if (!VALID_LOADERS.includes(normalized)) {
    throw new Error(`Invalid loader. Must be one of: ${VALID_LOADERS.join(", ")}`);
  }
  return normalized;
}

function validateMcVersion(mcVersion) {
  if (!mcVersion) return null;
  const trimmed = mcVersion.trim();
  if (trimmed === "") return null;
  return trimmed;
}

function createModpackJson(name, description, loader, mcVersion) {
  return {
    name,
    description: description || "",
    loader,
    mcVersion,
    mods: []
  };
}

async function promptUser(question, defaultValue = "") {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const promptText = defaultValue
      ? `${question} (${defaultValue}): `
      : `${question}: `;

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function promptLoader() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Loader (fabric/forge/neoforge/quilt) [auto]: ", (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed === "" ? null : validateLoader(trimmed));
    });
  });
}

async function promptMcVersion() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Minecraft version [auto]: ", (answer) => {
      rl.close();
      resolve(validateMcVersion(answer));
    });
  });
}

export async function initializeModpack(interactive = true) {
  const defaultName = getCurrentFolderName();

  let name, description, loader, mcVersion;

  if (interactive) {
    name = await promptUser("Modpack name", defaultName);
    description = await promptUser("Description");
    loader = await promptLoader();
    mcVersion = await promptMcVersion();
  } else {
    // Non-interactive mode with defaults
    name = defaultName;
    description = "";
    loader = null;
    mcVersion = null;
  }

  const modpackData = createModpackJson(name, description, loader, mcVersion);

  // Write to modpack.json
  const filePath = path.resolve("modpack.json");
  fs.writeFileSync(filePath, JSON.stringify(modpackData, null, 2) + "\n");

  return modpackData;
}

export async function checkExistingModpack() {
  const filePath = path.resolve("modpack.json");

  if (!fs.existsSync(filePath)) {
    return false;
  }

  // Check if it's a valid modpack.json (has the new structure)
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return data && typeof data === "object" && "name" in data && "mods" in data;
  } catch {
    return false;
  }
}

export async function promptOverwrite() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("modpack.json already exists. Overwrite? (y/N): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}