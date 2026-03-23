import chalk from "chalk";

export function printModDetails(mod) {
  console.log(chalk.green(`\n📦 ${mod.name}`));
  console.log(chalk.gray(mod.description));

  console.log(chalk.yellow("\nLatest Versions:\n"));

  mod.latestVersions.forEach((v, i) => {
    console.log(chalk.cyan(`(${i + 1}) ${v.version}`));
    console.log(`  Loaders: ${v.loaders.join(", ")}`);
    console.log(`  MC Versions: ${v.gameVersions.join(", ")}`);

    if (v.dependencies.length > 0) {
      console.log(`  Dependencies:`);

      v.dependencies.forEach((dep) => {
        console.log(`    - ${dep.project_id || dep.version_id}`);
      });
    } else {
      console.log(`  Dependencies: None`);
    }

    console.log("");
  });
}