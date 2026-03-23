#!/usr/bin/env node

import { program } from "commander";
import { getModDetails } from "../services/modService.js";
import { printModDetails } from "../utils/formatter.js";

program
  .name("mpe")
  .description("Mod Packer Engine CLI")
  .version("1.0.0");

program
  .command("search <modName>")
  .description("Search a mod and show details")
  .action(async (modName) => {
    try {
      const mod = await getModDetails(modName);
      printModDetails(mod);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

program.parse(process.argv);