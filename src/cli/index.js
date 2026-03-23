#!/usr/bin/env node

import { program } from "commander";
import { printModDetails } from "../utils/formatter.js";
import { buildDependencyGraph } from "../engine/graphBuilder.js";
import * as modService from "../services/modService.js";
import { printGraph } from "../utils/graphPrinter.js";

program
  .name("mpe")
  .description("Mod Packer Engine CLI")
  .version("1.0.0");

program
  .command("search <modName>")
  .description("Search a mod and show details")
  .action(async (modName) => {
    try {
      const mod = await modService.getModDetails(modName);
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

program.parse(process.argv);