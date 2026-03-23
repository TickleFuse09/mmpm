#!/usr/bin/env node

import { program } from "commander";
import { printModDetails } from "../utils/formatter.js";
import { buildDependencyGraph } from "../engine/graphBuilder.js";
import * as modService from "../services/modService.js";
import { printGraph } from "../utils/graphPrinter.js";
import { addMod } from "../services/modpackService.js";
import { detectLoaderConflicts } from "../engine/conflictDetector.js";
import { getModpack } from "../core/modpack.js";
import { resolveBestCombination } from "../engine/resolver.js";

program
  .name("mpe")
  .description("Mod Packer Engine CLI")
  .version("1.0.0");

program
  .command("search <modName>")
  .description("Search a mod and show details")
  .option("-l, --loader <loader>", "mod loader (fabric/forge)")
  .option("-v, --version <mcVersion>", "minecraft version")
  .action(async (modName, options) => {
    try {
      const filters = {
        loader: options.loader,
        mcVersion: options.version,
      };

      const mod = await modService.getModDetails(modName, filters);
      printModDetails(mod);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

program
  .command("graph <modName>")
  .option("-l, --loader <loader>", "mod loader (fabric/forge)")
  .option("-v, --version <mcVersion>", "minecraft version")
  .action(async (modName, options) => {
    try {
      const filters = {
        loader: options.loader,
        mcVersion: options.version,
      };

      const graph = await buildDependencyGraph(modService, modName, filters);
      printGraph(graph);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

program
  .command("add <modName>")
  .description("Add mod to modpack")
  .action(async (modName) => {
    try {
      const mod = await addMod(modName);

      console.log(`✅ Added: ${mod.name}`);

      const modpack = getModpack();

      if (modpack.mods.length > 1) {
        const result = await detectLoaderConflicts(modpack.mods);

        // 🔽 LOADER OUTPUT
        if (result.commonLoaders.size === 0) {
          console.log("\n⚠ Loader conflict detected:");

          result.loaderSets.forEach((entry) => {
            console.log(
              `- ${entry.mod} → ${[...entry.loaders].join(", ")}`
            );
          });

          console.log("❌ No common loader\n");
        } else {
          console.log(
            `\n✔ Compatible loaders: ${[
              ...result.commonLoaders,
            ].join(", ")}`
          );
        }

        // 🔽 VERSION OUTPUT
        if (result.commonVersions.size === 0) {
          console.log("\n⚠ Minecraft version conflict detected:");

          result.loaderSets.forEach((entry) => {
            console.log(
              `- ${entry.mod} → ${[...entry.mcVersions].slice(0, 5).join(", ")}...`
            );
          });

          console.log("❌ No common Minecraft version\n");
        } else {
          console.log(
            `\n✔ Compatible Minecraft versions: ${[
              ...result.commonVersions,
            ].slice(0, 5).join(", ")}\n`
          );
        }

        // 🔽 AUTO RESOLUTION
        const best = resolveBestCombination(result);

        if (best) {
          console.log("🚀 Suggested setup:");
          console.log(`- Loader: ${best.loader}`);
          console.log(`- Minecraft Version: ${best.mcVersion}\n`);
        } else {
          console.log("❌ Cannot auto-resolve due to conflicts\n");
        }
      }
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

program.parse(process.argv);