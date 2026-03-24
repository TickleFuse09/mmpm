import { addToModpack, getModpack } from "../core/modpack.js";
import { getModDetails } from "./modService.js";

export async function addMod(modName) {
  const mod = await getModDetails(modName);
  const modpack = getModpack();

  if (modpack.mods.includes(mod.slug)) {
    throw new Error("Mod already added");
  }

  addToModpack(mod.slug);

  return mod;
}
