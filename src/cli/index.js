#!/usr/bin/env node

import chalk from "chalk";
import { program } from "commander";
import { createInterface } from "readline";
import { getModpack, isModpackInitialized, updateModpackConfig } from "../core/modpack.js";
import { detectLoaderConflicts } from "../engine/conflictDetector.js";
import { buildDependencyGraph } from "../engine/graphBuilder.js";
import { resolveBestCombination, resolveFullModpack } from "../engine/resolver.js";
import { installMods } from "../services/installService.js";
import { generateLockFile, saveLockFile } from "../services/lockService.js";
import { checkExistingModpack, initializeModpack, promptOverwrite } from "../services/modpackInitService.js";
import { addMod } from "../services/modpackService.js";
import * as modService from "../services/modService.js";
import * as searchService from "../services/searchService.js";
import { printGraph } from "../utils/graphPrinter.js";

program
  .name("mmpm")
  .description("Mod Packer Engine CLI")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize a new modpack")
  .option("-y, --yes", "Skip prompts and use defaults")
  .action(async (options) => {
    try {
      const exists = await checkExistingModpack();

      if (exists && !options.yes) {
        const shouldOverwrite = await promptOverwrite();
        if (!shouldOverwrite) {
          console.log(chalk.yellow("Init cancelled\n"));
          return;
        }
      }

      const modpack = await initializeModpack(!options.yes);
      console.log(chalk.green.bold("✔ modpack.json created\n"));
    } catch (err) {
      console.error(chalk.red.bold("[ERROR]"), err.message);
    }
  });

program
  .command("search <query>")
  .description("Interactive paginated search for mods on Modrinth")
  .action(async (query) => {
    try {
      // Fetch all search results
      console.log(chalk.blue.bold(`\n🔍 Searching for "${query}"...\n`));
      const { allResults, totalHits } = await searchService.performSearch(query);

      if (allResults.length === 0) {
        console.log(chalk.red.bold("❌ No mods found matching your query\n"));
        return;
      }

      console.log(chalk.green.bold(`✓ Found ${totalHits} results\n`));

      // Start interactive pagination
      await startInteractiveSearch(allResults);
      searchService.clearVersionCache();
    } catch (err) {
      console.error(chalk.red.bold("[ERROR]"), err.message);
      searchService.clearVersionCache();
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
      if (!isModpackInitialized()) {
        console.error(chalk.red.bold("[ERROR]"), "Modpack not initialized. Run 'mmpm init' first");
        return;
      }

      const mod = await addMod(modName);

      console.log(chalk.green(`✔ Added: ${mod.name}`));

      const modpack = getModpack();

      if (modpack.loader !== null || modpack.mcVersion !== null) {
        console.log(chalk.green("✔ All mods compatible with selected constraints"));
        return;
      }

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

        if (!best) {
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
      if (!isModpackInitialized()) {
        console.error(chalk.red.bold("[ERROR]"), "Modpack not initialized. Run 'mmpm init' first");
        return;
      }

      const modpack = getModpack();

      const result = await resolveFullModpack(modpack.mods, {
        loader: modpack.loader,
        mcVersion: modpack.mcVersion,
      });

      if (!result) {
        console.log("❌ No compatible configuration found under given constraints\n");
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

      // Persist resolved configuration into modpack.json
      updateModpackConfig(result.loader, result.mcVersion);
      console.log(chalk.green.bold("✔ Saved resolved configuration to modpack.json\n"));
    } catch (err) {
      console.error("[ERROR]", err.message);
    }
  });

program
  .command("lock")
  .description("Generate modpack-lock.json with full dependency resolution")
  .action(async () => {
    try {
      if (!isModpackInitialized()) {
        console.error(chalk.red.bold("[ERROR]"), "Modpack not initialized. Run 'mmpm init' first");
        return;
      }

      const modpack = getModpack();

      if (modpack.mods.length === 0) {
        console.error(chalk.red.bold("[ERROR]"), "No mods in modpack");
        return;
      }

      if (!modpack.loader || !modpack.mcVersion) {
        console.error(chalk.red.bold("[ERROR]"), "Modpack must have loader and mcVersion set");
        return;
      }

      console.log(chalk.blue.bold("\n🔒 Generating lock file...\n"));

      const lockFile = await generateLockFile(modpack);
      const filePath = saveLockFile(lockFile);

      console.log(chalk.green.bold("✔ modpack-lock.json generated\n"));

      console.log(`Loader: ${lockFile.loader}`);
      console.log(`Minecraft: ${lockFile.mcVersion}`);
      console.log(`Total mods (with dependencies): ${lockFile.mods.length}\n`);

      console.log("Mods:");
      lockFile.mods.forEach((mod) => {
        const depCount = mod.dependencies.length;
        const depStr = depCount > 0 ? ` (${depCount} dependencies)` : "";
        console.log(`  • ${mod.slug} ${chalk.dim(mod.version_number)}${depStr}`);
      });

      console.log("");
    } catch (err) {
      console.error(chalk.red.bold("[ERROR]"), err.message);
    }
  });

program
  .command("install")
  .description("Download and install all mods from modpack-lock.json")
  .action(async () => {
    try {
      await installMods();
    } catch (err) {
      console.error(chalk.red.bold("[ERROR]"), err.message);
    }
  });

program.parse(process.argv);

/**
 * Start interactive search mode with pagination
 * @param {Array} allResults
 */
async function startInteractiveSearch(allResults) {
  let currentPage = 1;
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askForCommand = () => {
    rl.question(
      chalk.cyan.bold("\n► ") + chalk.dim('("next", "prev", "exit"): '),
      async (command) => {
        command = command.trim().toLowerCase();

        try {
          if (command === "exit") {
            console.log(chalk.green.bold("\n✓ Exiting search mode\n"));
            rl.close();
            return;
          }

          if (command === "next") {
            currentPage += 1;
          } else if (command === "prev") {
            currentPage -= 1;
          } else {
            console.log(
              chalk.yellow.bold("[HELP]") +
                chalk.dim(
                  ' Valid commands: "next" | "prev" | "exit"'
                )
            );
            askForCommand();
            return;
          }

          // Display the requested page
          const { results, pageInfo } = await searchService.getPaginatedResults(
            allResults,
            currentPage
          );

          console.log("\n" + results);
          const pageStr =
            chalk.bold.cyanBright(
              `Page ${pageInfo.currentPage} of ${pageInfo.totalPages}`
            ) +
            chalk.dim(` (${pageInfo.totalResults} total)\n`);
          console.log(pageStr);

          askForCommand();
        } catch (err) {
          console.error(chalk.red.bold("[ERROR]"), err.message);
          rl.close();
        }
      }
    );
  };

  // Display first page
  const { results, pageInfo } = await searchService.getPaginatedResults(
    allResults,
    currentPage
  );

  console.log("\n" + results);
  const pageStr =
    chalk.bold.cyanBright(
      `Page ${pageInfo.currentPage} of ${pageInfo.totalPages}`
    ) +
    chalk.dim(` (${pageInfo.totalResults} total)\n`);
  console.log(pageStr);

  askForCommand();
}
