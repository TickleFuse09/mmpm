import { addToModpack, getModpack } from "../core/modpack.js";
import { getModDetails } from "./modService.js";

export async function addMod(modName) {
  // prevent duplicates
  const modpack = getModpack();
  if (modpack.mods.includes(modName)) {
    throw new Error("Mod already added");
  }

  // fetch mod details
  const mod = await getModDetails(modName);

  addToModpack(mod.slug);

  return mod;
}