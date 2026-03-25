import { addToModpack, getModpack } from "../core/modpack.js";
import { verifyModpackConstraints } from "../engine/conflictDetector.js";
import { getModDetails } from "./modService.js";

export async function addMod(modName) {
  const mod = await getModDetails(modName);
  const modpack = getModpack();

  if (modpack.mods.includes(mod.slug)) {
    throw new Error("Mod already added");
  }

  const candidateMods = [...modpack.mods, mod.slug];

  if (modpack.loader !== null || modpack.mcVersion !== null) {
    const check = await verifyModpackConstraints(
      candidateMods,
      modpack.loader,
      modpack.mcVersion
    );

    if (!check.valid) {
      let message = "";

      if (check.loaderViolations.length > 0) {
        message += "❌ Loader constraint violated:\n\n";
        check.loaderViolations.forEach((entry) => {
          message += `* ${entry.mod} does not support ${entry.loader}\n`;
        });
      }

      if (check.mcVersionViolations.length > 0) {
        if (message) message += "\n";
        message += "❌ Minecraft version constraint violated:\n\n";
        check.mcVersionViolations.forEach((entry) => {
          message += `* ${entry.mod} does not support ${entry.mcVersion}\n`;
        });
      }

      throw new Error(message.trim());
    }
  }

  addToModpack(mod.slug);

  return mod;
}
