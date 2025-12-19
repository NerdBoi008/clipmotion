import chalk from "chalk";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ContributorInfo, CreditOptions } from "./types.js";

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

function getRegistryRoot(local: boolean): string {
  if (local) {
    // Use registry inside the ClipMotion repo (build output)
    return join(__dirname, "..", "public", "r");
  }

  // Remote mode is not meaningful for `credits` in user projects,
  // so we only support local mode for now.
  // You can later extend this to fetch from remote if you really want.
  return join(process.cwd(), "public", "r");
}

/* -------------------------------------------------------------------------- */
/*                        MAIN CREDITS FETCH UTILS                            */
/* -------------------------------------------------------------------------- */

async function showComponentCredits(
  componentName: string,
  local: boolean
): Promise<void> {
  const registryRoot = getRegistryRoot(local);
  const indexPath = join(registryRoot, "index.json");

  if (!existsSync(indexPath)) {
    console.error(
      chalk.red(
        local
          ? "Local registry not found. Run in ClipMotion repo and `npm run registry:build`."
          : "Registry not found. Use --local when developing against the ClipMotion repo."
      )
    );
    process.exit(1);
  }

  try {
    const frameworks = ["nextjs", "react", "vue", "angular"];
    let found = false;

    for (const framework of frameworks) {
      const componentPath = join(
        registryRoot,
        framework,
        `${componentName}.json`
      );

      if (!existsSync(componentPath)) continue;

      const componentData = JSON.parse(readFileSync(componentPath, "utf-8"));

      if (componentData.meta?.contributor) {
        found = true;
        const { contributor } = componentData.meta;

        console.log(chalk.cyan.bold(`📦 ${componentData.name}`));
        console.log(chalk.gray(`   ${componentData.description}\n`));

        console.log(chalk.green("   ✨ Created by:"));
        console.log(
          chalk.white(`      ${contributor.name || "Anonymous Contributor"}`)
        );

        if (contributor.github) {
          console.log(chalk.blue(`      🔗 GitHub: ${contributor.github}`));
        }
        if (contributor.twitter) {
          console.log(chalk.blue(`      🐦 X: ${contributor.x}`));
        }
        if (contributor.website) {
          console.log(chalk.blue(`      🌐 Website: ${contributor.website}`));
        }

        if (componentData.meta.source) {
          console.log(
            chalk.gray(`\n   📹 Source: ${componentData.meta.source}`)
          );
        }

        console.log(chalk.gray(`\n   🎯 Available for: ${framework}\n`));
      }
    }

    if (!found) {
      console.log(
        chalk.yellow(
          `Component "${componentName}" not found or has no credits.`
        )
      );
    }
  } catch (error) {
    console.error(chalk.red("Failed to load credits"));
    if (error instanceof Error) {
      console.error(chalk.gray(error.message));
    }
  }
}

async function showAllContributors(local: boolean): Promise<void> {
  const registryRoot = getRegistryRoot(local);

  if (!existsSync(registryRoot)) {
    console.error(
      chalk.red(
        local
          ? "Local registry not found. Run in ClipMotion repo and `npm run registry:build`."
          : "Registry not found. Use --local when developing against the ClipMotion repo."
      )
    );
    process.exit(1);
  }

  try {
    const frameworks = ["nextjs", "react", "vue", "angular"];
    const contributorsMap = new Map<
      string,
      {
        contributor: ContributorInfo;
        components: string[];
      }
    >();

    for (const framework of frameworks) {
      const frameworkPath = join(registryRoot, framework);
      if (!existsSync(frameworkPath)) continue;

      const files = require("fs").readdirSync(frameworkPath);

      for (const file of files) {
        if (!file.endsWith(".json") || file === "index.json") continue;

        const componentPath = join(frameworkPath, file);
        const componentData = JSON.parse(readFileSync(componentPath, "utf-8"));

        if (componentData.meta?.contributor) {
          const { contributor } = componentData.meta;
          const key = contributor.github || contributor.name || "anonymous";

          if (!contributorsMap.has(key)) {
            contributorsMap.set(key, {
              contributor,
              components: [],
            });
          }

          contributorsMap.get(key)!.components.push(componentData.name);
        }
      }
    }

    if (contributorsMap.size === 0) {
      console.log(chalk.yellow("No contributor information found.\n"));
      return;
    }

    console.log(
      chalk.gray(
        `${contributorsMap.size} contributor${
          contributorsMap.size > 1 ? "s" : ""
        } have made ClipMotion possible:\n`
      )
    );

    let index = 1;
    for (const [, data] of contributorsMap) {
      const { contributor, components } = data;

      console.log(
        chalk.cyan.bold(`${index}. ${contributor.name || "Anonymous"}`)
      );
      console.log(
        chalk.gray(
          `   ${components.length} component${
            components.length > 1 ? "s" : ""
          }: `
        ) + chalk.white(components.join(", "))
      );

      if (contributor.github) {
        console.log(chalk.blue(`   🔗 ${contributor.github}`));
      }

      console.log();
      index++;
    }

    console.log(chalk.green.bold("💚 Thank you to all our contributors!\n"));
    console.log(
      chalk.gray(
        "Want to contribute? Visit: https://github.com/nerdboi008/clipmotion\n"
      )
    );
  } catch (error) {
    console.error(chalk.red("Failed to load contributors"));
    if (error instanceof Error) {
      console.error(chalk.gray(error.message));
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMMAND                                 */
/* -------------------------------------------------------------------------- */

export async function showCredits(
  componentName?: string,
  options: CreditOptions = {}
): Promise<void> {
  console.log(chalk.blue.bold("\n🎬 ClipMotion Credits\n"));

  if (componentName) {
    // Show credits for specific component
    await showComponentCredits(componentName, options.local === true);
  } else {
    // Show all contributors
    await showAllContributors(options.local === true);
  }
}
