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
  .description("Build dependency graph for a mod")
  .action(async (modName) => {
    try {
      const graph = await buildDependencyGraph(modService, modName);
      printGraph(graph);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

program.parse(process.argv);