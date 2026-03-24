#!/usr/bin/env node

import { program } from "commander";
import { printModDetails } from "../utils/formatter.js";
import { buildDependencyGraph } from "../engine/graphBuilder.js";
import * as modService from "../services/modService.js";
import { printGraph } from "../utils/graphPrinter.js";
import { addMod } from "../services/modpackService.js";
import { detectLoaderConflicts } from "../engine/conflictDetector.js";
import { getModpack } from "../core/modpack.js";
import { resolveFullModpack, resolveBestCombination } from "../engine/resolver.js";

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
      console.error("[ERROR]", err.message);
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
      console.error("[ERROR]", err.message);
    }
  });

program
  .command("add <modName>")
  .description("Add mod to modpack")
  .action(async (modName) => {
    try {
      const mod = await addMod(modName);

      console.log(`[OK] Added: ${mod.name}`);

      const modpack = getModpack();

      if (modpack.mods.length > 1) {
        const result = await detectLoaderConflicts(modpack.mods);

        if (result.commonLoaders.size === 0) {
          console.log("\n[WARN] Loader conflict detected:");

          result.loaderSets.forEach((entry) => {
            console.log(`- ${entry.mod} -> ${[...entry.loaders].join(", ")}`);
          });

          console.log("[ERROR] No common loader\n");
        } else {
          console.log(
            `\n[OK] Compatible loaders: ${[...result.commonLoaders].join(", ")}`
          );
        }

        if (result.commonVersions.size === 0) {
          console.log("\n[WARN] Minecraft version conflict detected:");

          result.loaderSets.forEach((entry) => {
            console.log(
              `- ${entry.mod} -> ${[...entry.mcVersions].slice(0, 5).join(", ")}...`
            );
          });

          console.log("[ERROR] No common Minecraft version\n");
        } else {
          console.log(
            `\n[OK] Compatible Minecraft versions: ${[...result.commonVersions]
              .slice(0, 5)
              .join(", ")}\n`
          );
        }

        const best = resolveBestCombination(result);

        if (best) {
          console.log("[OK] Suggested setup:");
          console.log(`- Loader: ${best.loader}`);
          console.log(`- Minecraft Version: ${best.mcVersion}\n`);
        } else {
          console.log("[ERROR] Cannot auto-resolve due to conflicts\n");
        }
      }
    } catch (err) {
      console.error("[ERROR]", err.message);
    }
  });

program
  .command("resolve")
  .description("Resolve full modpack with best versions")
  .action(async () => {
    try {
      const modpack = getModpack();

      const result = await resolveFullModpack(modpack.mods);

      if (!result) {
        console.log("[ERROR] No compatible configuration found\n");
        return;
      }

      console.log("\n[OK] Final Modpack:\n");
      console.log(`Loader: ${result.loader}`);
      console.log(`Minecraft: ${result.mcVersion}\n`);

      console.log("Mods:");
      Object.entries(result.mods).forEach(([mod, version]) => {
        console.log(`- ${mod} -> ${version}`);
      });

      console.log("");
    } catch (err) {
      console.error("[ERROR]", err.message);
    }
  });

program.parse(process.argv);
