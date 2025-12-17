import chalk from "chalk";
import { execa } from "execa";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import ora from "ora";
import { join, dirname } from "path";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

interface ComponentConfig {
  $schema?: string;
  style?: string;
  aliases: {
    components: string;
    utils: string;
  };
  tailwind?: {
    config: string;
    css: string;
    baseColor: string;
    cssVariables: boolean;
  };
}

interface RegistryComponent {
  name: string;
  type: string;
  files: Array<{
    name: string;
    content: string;
  }>;
  dependencies?: string[];
  registryDependencies?: string[];
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

const REGISTRY_URL =
  "https://raw.githubusercontent.com/nerdboi008/clipmotion/main/public/r";

const DEBUG = true;

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

function logDebug(...args: any[]) {
  if (DEBUG) {
    console.log(chalk.gray("[DEBUG]"), ...args);
  }
}

function detectPackageManager(): "npm" | "yarn" | "pnpm" {
  if (existsSync(join(process.cwd(), "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(process.cwd(), "yarn.lock"))) return "yarn";
  return "npm";
}

async function installDependencies(deps: string[]) {
  if (!deps.length) return;

  const pm = detectPackageManager();
  logDebug("Installing dependencies with:", pm, deps);

  try {
    if (pm === "npm") await execa("npm", ["install", ...deps], { stdio: "inherit" });
    if (pm === "yarn") await execa("yarn", ["add", ...deps], { stdio: "inherit" });
    if (pm === "pnpm") await execa("pnpm", ["add", ...deps], { stdio: "inherit" });
  } catch (err) {
    throw new Error("Dependency installation failed");
  }
}

/* -------------------------------------------------------------------------- */
/*                              REGISTRY FETCH                                */
/* -------------------------------------------------------------------------- */

async function fetchComponent(
  componentName: string,
  style: string
): Promise<RegistryComponent> {
  const url = `${REGISTRY_URL}/${style}/${componentName}.json`;

  logDebug("Fetching component");
  logDebug("  style:", style);
  logDebug("  component:", componentName);
  logDebug("  url:", url);

  const res = await fetch(url);

  logDebug("  response.status:", res.status);

  if (!res.ok) {
    const body = await res.text();
    logDebug("  response.body:", body.slice(0, 200));
    throw new Error(`Component "${componentName}" not found in registry`);
  }

  return (await res.json()) as RegistryComponent;
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMMAND                                 */
/* -------------------------------------------------------------------------- */

export async function addComponent(
  components: string[],
  installed = new Set<string>()
) {
  
  if (!installed || !(installed instanceof Set)) {
    installed = new Set<string>();
  }
  
  console.log(chalk.blue(`\nAdding ${components.length} component(s)...\n`));

  /* ------------------------------ Load config ------------------------------ */

  const configPath = join(process.cwd(), "components.json");

  if (!existsSync(configPath)) {
    console.error(chalk.red("components.json not found"));
    console.log(chalk.yellow('Run "clipmotion init" first.'));
    process.exit(1);
  }

  let config: ComponentConfig;
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    console.error(chalk.red("Failed to parse components.json"));
    process.exit(1);
  }

  const style = config.style ?? "default";

  if (!config.aliases?.components) {
    console.error(chalk.red("Invalid config: aliases.components missing"));
    process.exit(1);
  }

  logDebug("Loaded config");
  logDebug("Style:", style);
  logDebug("Components path:", config.aliases.components);

  let hasErrors = false;

  /* --------------------------- Install components -------------------------- */

  for (const componentName of components) {
    if (installed.has(componentName)) {
      logDebug(`Skipping already installed: ${componentName}`);
      continue;
    }

    installed.add(componentName);

    const spinner = ora(`Installing ${componentName}...`).start();

    try {
      const component = await fetchComponent(componentName, style);

      /* ----------------------- Registry dependencies ----------------------- */

      if (component.registryDependencies?.length) {
        spinner.stop();
        logDebug(
          "Registry dependencies:",
          component.registryDependencies
        );

        await addComponent(component.registryDependencies, installed);
        spinner.start(`Installing ${componentName}...`);
      }

      /* -------------------------- NPM dependencies ------------------------- */

      if (component.dependencies?.length) {
        spinner.text = `Installing dependencies for ${componentName}...`;
        await installDependencies(component.dependencies);
      }

      /* ----------------------------- Write files ---------------------------- */

      for (const file of component.files) {
        const targetPath = join(
          process.cwd(),
          config.aliases.components,
          file.name
        );

        logDebug("Writing file:", targetPath);

        const dir = dirname(targetPath);
        if (!existsSync(dir)) {
          logDebug("Creating directory:", dir);
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(targetPath, file.content, "utf-8");
      }

      spinner.succeed(chalk.green(`Installed ${componentName}`));
    } catch (err) {
      hasErrors = true;
      spinner.fail(chalk.red(`Failed to install ${componentName}`));

      if (err instanceof Error) {
        console.error(chalk.red(" ", err.message));
      }
    }
  }

  /* ------------------------------ Final output ----------------------------- */

  if (!hasErrors) {
    console.log(chalk.green("\n✓ All components installed successfully!\n"));
  } else {
    console.log(
      chalk.yellow("\n⚠ Some components failed to install. See logs above.\n")
    );
  }
}


// import chalk from "chalk";
// import { execa } from "execa";
// import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
// import ora from "ora";
// import { join, dirname } from "path";

// interface ComponentConfig {
//   $schema?: string;
//   style?: string;
//   aliases: {
//     components: string;
//     utils: string;
//   };
//   tailwind?: {
//     config: string;
//     css: string;
//     baseColor: string;
//     cssVariables: boolean;
//   };
// }

// interface RegistryComponent {
//   name: string;
//   type: string;
//   files: Array<{
//     name: string;
//     content: string;
//   }>;
//   dependencies?: string[];
//   registryDependencies?: string[];
// }

// export async function addComponent(components: string[]) {
//   console.log(chalk.blue(`Adding ${components.length} component(s)...\n`));

//   // 1. Read config file
//   const configPath = join(process.cwd(), "components.json");
//   if (!existsSync(configPath)) {
//     console.error(chalk.red("Error: components.json not found."));
//     console.log(
//       chalk.yellow('Run "clipmotion init" first to initialize your project.')
//     );
//     process.exit(1);
//   }

//   let config: ComponentConfig;
//   try {
//     config = JSON.parse(readFileSync(configPath, "utf-8"));
//   } catch (error) {
//     console.error(chalk.red("Error: Failed to parse components.json"));
//     process.exit(1);
//   }

//   const style = config.style || 'default'; // Default to nextjs

//   // Validate config
//   if (!config.aliases?.components) {
//     console.error(
//       chalk.red("Error: Invalid components.json - missing aliases.components")
//     );
//     console.log(
//       chalk.yellow('Run "clipmotion init" to recreate the config file.')
//     );
//     process.exit(1);
//   }

//   // 2. Process each component
//   for (const componentName of components) {
//     const spinner = ora(`Installing ${componentName}...`).start();

//     try {
//       // Fetch component from registry
//       const registryData = await fetchComponent(componentName, style);

//       if (!registryData) {
//         throw new Error("Component not found in registry.");
//       }

//       // Install npm dependencies
//       if (registryData.dependencies && registryData.dependencies.length > 0) {
//         spinner.text = `Installing dependencies for ${componentName}...`;
//         await installDependencies(registryData.dependencies);
//       }

//       // Install registry dependencies (other components from your library)
//       if (
//         registryData.registryDependencies &&
//         registryData.registryDependencies.length > 0
//       ) {
//         spinner.stop();
//         for (const dep of registryData.registryDependencies) {
//           await addComponent([dep]); // Recursively install dependencies
//         }
//         spinner.start(`Installing ${componentName}...`);
//       }

//       // Write component files
//       for (const file of registryData.files) {
//         const filePath = join(
//           process.cwd(),
//           config.aliases.components,
//           file.name
//         );

//         // Create directory if it doesn't exist
//         const dir = dirname(filePath);
//         if (!existsSync(dir)) {
//           mkdirSync(dir, { recursive: true });
//         }

//         // Write file content
//         writeFileSync(filePath, file.content, "utf-8");
//       }

//       spinner.succeed(chalk.green(`Installed ${componentName}`));
//     } catch (error) {
//       spinner.fail(chalk.red(`Failed to install ${componentName}`));
//       if (error instanceof Error) {
//         console.error(chalk.red(`  ${error.message}`));
//       }
//     }
//   }

//   console.log(chalk.green("\n✓ All components installed successfully!\n"));
// }

// async function fetchComponent(
//   componentName: string,
//   style: string,
// ): Promise<RegistryComponent | null> {
//   const REGISTRY_URL = "https://raw.githubusercontent.com/nerdboi008/clipmotion/main/public/r";

//   try {
//     const response = await fetch(`${REGISTRY_URL}/${style}/${componentName}.json`);

//     if (!response.ok) {
//       throw new Error(`Component "${componentName}" not found in registry`);
//     }

//     return await response.json() as RegistryComponent;
//   } catch (error) {
//     if (error instanceof Error) {
//       throw new Error(`Failed to fetch component: ${error.message}`);
//     }
//     throw new Error("Failed to fetch component");
//   }
// }

// async function installDependencies(deps: string[]): Promise<void> {
//   const packageManager = detectPackageManager();

//   try {
//     if (packageManager === "npm") {
//       await execa("npm", ["install", ...deps]);
//     } else if (packageManager === "yarn") {
//       await execa("yarn", ["add", ...deps]);
//     } else if (packageManager === "pnpm") {
//       await execa("pnpm", ["add", ...deps]);
//     }
//   } catch (error) {
//     throw new Error(`Failed to install dependencies: ${error}`);
//   }
// }

// function detectPackageManager(): string {
//   if (existsSync(join(process.cwd(), "package-lock.json"))) {
//     return "npm";
//   } else if (existsSync(join(process.cwd(), "yarn.lock"))) {
//     return "yarn";
//   } else if (existsSync(join(process.cwd(), "pnpm-lock.yaml"))) {
//     return "pnpm";
//   }
//   return "npm";
// }
