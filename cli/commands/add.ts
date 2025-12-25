import chalk from "chalk";
import { execa } from "execa";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import ora, { type Ora } from "ora";
import { join, dirname, basename, extname } from "path";
import type {
  Framework,
  AddOptions,
  InstallContext,
  ComponentConfig,
  RegistryComponent,
  PackageManager,
  MergeResult,
} from "./types.js";

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/nerdboi008/clipmotion/main/public/r";

let DEBUG = false;

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

function logDebug(...args: any[]): void {
  if (DEBUG) {
    console.log(chalk.gray("[DEBUG]"), ...args);
  }
}

function logError(message: string, error?: Error): void {
  console.error(chalk.red(`✗ ${message}`));
  if (error && DEBUG) {
    console.error(chalk.gray(error.stack || error.message));
  }
}

function detectPackageManager(): PackageManager {
  const cwd = process.cwd();

  if (existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";

  return "npm";
}

async function installDependencies(
  deps: string[],
  dev: boolean = false
): Promise<void> {
  if (!deps.length) return;

  const pm = detectPackageManager();
  logDebug(`Installing ${dev ? "dev " : ""}dependencies with ${pm}:`, deps);

  try {
    const commands: Record<PackageManager, string[]> = {
      npm: ["install", dev ? "--save-dev" : "", ...deps].filter(Boolean),
      yarn: ["add", dev ? "--dev" : "", ...deps].filter(Boolean),
      pnpm: ["add", dev ? "--save-dev" : "", ...deps].filter(Boolean),
      bun: ["add", dev ? "--dev" : "", ...deps].filter(Boolean),
    };

    await execa(pm, commands[pm], {
      stdio: DEBUG ? "inherit" : "pipe",
      cwd: process.cwd(),
    });

    logDebug("Dependencies installed successfully");
  } catch (error) {
    throw new Error(
      `Failed to install dependencies with ${pm}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function loadConfig(cwd: string): ComponentConfig {
  const configPath = join(cwd, "clipmotion-components.json");

  if (!existsSync(configPath)) {
    console.error(chalk.red("\n✗ Configuration file not found"));
    console.log(chalk.yellow("  Run: clipmotion init\n"));
    process.exit(1);
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as ComponentConfig;
  } catch (error) {
    logError("Failed to parse configuration file", error as Error);
    process.exit(1);
  }
}

function ensureDirectory(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logDebug("Created directory:", dir);
  }
}

function getRegistryUrl(
  config: ComponentConfig,
  local: boolean = false
): string {
  if (local) {
    // Use local file system instead of GitHub
    const localRegistryPath = join(process.cwd(), "public/r");
    logDebug("Using local registry:", localRegistryPath);
    return `file://${localRegistryPath}`;
  }

  return config.registry?.baseUrl || DEFAULT_REGISTRY_URL;
}

function displayContributorCredit(component: RegistryComponent): void {
  const c = component.meta?.contributor;
  if (!c) return;

  const name = c.name || "Anonymous";
  const links: string[] = [];

  if (c.github) links.push(`GitHub: ${c.github}`);
  if (c.x) links.push(`Twitter: ${c.x}`);
  if (c.website) links.push(`Web: ${c.website}`);

  console.log(
    chalk.gray(
      "\n  ───────────────────────── Credits ─────────────────────────"
    )
  );

  console.log(
    "  " + chalk.bgGray.black("  Contributor  ") + " " + chalk.bold.cyan(name)
  );

  if (links.length) {
    console.log(
      "  " +
        chalk.gray("\n  Links:") +
        "  " +
        links.map((l) => chalk.blue(`\n   ${l}`))
      // links.map((l) => chalk.blue(l)).join(chalk.gray("  •  "))
    );
  }

  console.log(
    chalk.gray("  ──────────────────────────────────────────────────────────\n")
  );
}

/* -------------------------------------------------------------------------- */
/*                          FRAMEWORK DETECTION                               */
/* -------------------------------------------------------------------------- */

function validateFramework(framework: string): framework is Framework {
  const validFrameworks: Framework[] = ["nextjs", "react", "vue", "angular"];
  return validFrameworks.includes(framework as Framework);
}

async function getAvailableFrameworks(
  componentName: string,
  registryUrl: string
): Promise<Framework[]> {
  const frameworks: Framework[] = ["nextjs", "react", "vue", "angular"];
  const available: Framework[] = [];

  for (const fw of frameworks) {
    try {
      const url = `${registryUrl}/${fw}/${componentName}.json`;
      const res = await fetch(url, { method: "HEAD" });

      if (res.ok) {
        available.push(fw);
      } else {
        logDebug(`Component not available for ${fw}: HTTP ${res.status}`);
      }
    } catch (error) {
      logDebug(
        `Failed to check ${fw} for ${componentName}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return available;
}

/* -------------------------------------------------------------------------- */
/*                           UTILS FILE MERGING                               */
/* -------------------------------------------------------------------------- */

function isUtilsFile(filename: string): boolean {
  const normalizedPath = filename.toLowerCase().replace(/\\/g, "/");

  const utilsPatterns = [
    /^utils\.(ts|js|tsx|jsx)$/, // utils.ts
    /^utils\/index\.(ts|js|tsx|jsx)$/, // utils/index.ts
    /\/utils\/index\.(ts|js|tsx|jsx)$/, // some/path/utils/index.ts
    /^cn\.(ts|js)$/, // cn.ts
    /^cn\/index\.(ts|js)$/, // cn/index.ts
  ];

  return utilsPatterns.some((pattern) => pattern.test(normalizedPath));
}

function extractFunctionNames(content: string): string[] {
  const functions = new Set<string>();

  // Match function declarations
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    functions.add(match[1]!);
  }

  // Match arrow functions and const declarations
  const arrowRegex =
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s*)?\(|(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    if (name) functions.add(name);
  }

  return Array.from(functions);
}

function extractFunctionCode(
  content: string,
  functionName: string
): string | null {
  // Try to match function declaration
  const functionPattern = new RegExp(
    `((?:export\\s+)?(?:async\\s+)?function\\s+${functionName}\\s*[^{]*\\{(?:[^{}]|\\{[^{}]*\\})*\\})`,
    "s"
  );

  let match = content.match(functionPattern);
  if (match) return match[1]!;

  // Try to match arrow function or const
  const arrowPattern = new RegExp(
    `((?:export\\s+)?(?:const|let|var)\\s+${functionName}\\s*[:=][^;]*(?:;|\\n))`,
    "s"
  );

  match = content.match(arrowPattern);
  if (match) return match[1]!;

  return null;
}

async function mergeUtilsFile(
  targetPath: string,
  newContent: string,
  overwrite: boolean = false
): Promise<MergeResult> {
  // If file doesn't exist, create it
  if (!existsSync(targetPath)) {
    ensureDirectory(targetPath);
    writeFileSync(targetPath, newContent, "utf-8");
    logDebug("Created new utils file:", targetPath);
    return "created";
  }

  // If overwrite flag is set, replace entirely
  if (overwrite) {
    writeFileSync(targetPath, newContent, "utf-8");
    logDebug("Overwrote utils file:", targetPath);
    return "created";
  }

  // Read existing content
  const existingContent = readFileSync(targetPath, "utf-8");

  // Extract function names
  const newFunctions = extractFunctionNames(newContent);
  const existingFunctions = extractFunctionNames(existingContent);

  logDebug("New functions:", newFunctions);
  logDebug("Existing functions:", existingFunctions);

  // Find functions that need to be added
  const missingFunctions = newFunctions.filter(
    (fn) => !existingFunctions.includes(fn)
  );

  if (missingFunctions.length === 0) {
    logDebug("All functions already exist, skipping merge");
    return "skipped";
  }

  logDebug("Missing functions to add:", missingFunctions);

  // Extract code for missing functions
  const functionsToAdd: string[] = [];
  for (const fnName of missingFunctions) {
    const fnCode = extractFunctionCode(newContent, fnName);
    if (fnCode) {
      functionsToAdd.push(fnCode.trim());
    }
  }

  if (functionsToAdd.length === 0) {
    return "skipped";
  }

  // Merge: append missing functions
  const separator = "\n\n";
  const mergedContent =
    existingContent.trimEnd() +
    separator +
    functionsToAdd.join(separator) +
    "\n";

  writeFileSync(targetPath, mergedContent, "utf-8");
  logDebug(`Merged ${functionsToAdd.length} new functions into:`, targetPath);

  return "merged";
}

/* -------------------------------------------------------------------------- */
/*                              REGISTRY FETCH                                */
/* -------------------------------------------------------------------------- */

async function fetchComponent(
  componentName: string,
  framework: Framework,
  registryUrl: string,
  local: boolean = false
): Promise<RegistryComponent> {
  // -------------------------------
  // LOCAL REGISTRY (filesystem)
  // -------------------------------
  if (local) {
    // Absolute path to local registry
    const localRegistryPath = join(
      __dirname,
      "..", // build
      "public",
      "r"
    );

    const componentPath = join(
      localRegistryPath,
      framework,
      `${componentName}.json`
    );

    logDebug("Loading component from local registry:");
    logDebug("  Path:", componentPath);

    if (!existsSync(componentPath)) {
      throw new Error(
        `Component "${componentName}" not found locally for ${framework}\n` +
          `  Expected: ${componentPath}`
      );
    }

    try {
      const content = readFileSync(componentPath, "utf-8");
      const data = JSON.parse(content);
      logDebug("  Loaded successfully from local registry");
      return data as RegistryComponent;
    } catch (error) {
      throw new Error(
        `Failed to read local component: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // -------------------------------
  // REMOTE REGISTRY (https)
  // -------------------------------
  const url = `${registryUrl}/${framework}/${componentName}.json`;

  logDebug("Fetching component:");
  logDebug("  Name:", componentName);
  logDebug("  Framework:", framework);
  logDebug("  URL:", url);

  try {
    const res = await fetch(url);

    logDebug("  Status:", res.status);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          `Component "${componentName}" not found for ${framework}`
        );
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    logDebug("  Fetched successfully from remote registry");

    return data as RegistryComponent;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch component: ${error.message}`);
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*                           COMPONENT INSTALLER                              */
/* -------------------------------------------------------------------------- */

async function installSingleComponent(
  componentName: string,
  context: InstallContext
): Promise<boolean> {
  const { installed, config, framework, options, spinner } = context;

  // Skip if already installed
  if (installed.has(componentName)) {
    logDebug(`Skipping already installed: ${componentName}`);
    return true;
  }

  installed.add(componentName);

  spinner?.start(`Installing ${chalk.cyan(componentName)}...\n`);

  try {
    const registryUrl = getRegistryUrl(config);
    const component = await fetchComponent(
      componentName,
      framework,
      registryUrl,
      options.local
    );

    // Install registry dependencies first
    if (component.registryDependencies?.length) {
      spinner?.stop();
      logDebug("Registry dependencies:", component.registryDependencies);

      for (const dep of component.registryDependencies) {
        const success = await installSingleComponent(dep, context);
        if (!success) {
          throw new Error(`Failed to install dependency: ${dep}`);
        }
      }

      spinner?.start(`Installing ${chalk.cyan(componentName)}...\n`);
    }

    // Install npm dependencies
    if (component.dependencies?.length) {
      spinner && (spinner.text = `Installing npm dependencies...`);
      await installDependencies(component.dependencies);
    }

    // Install dev dependencies
    if (component.devDependencies?.length) {
      spinner && (spinner.text = `Installing dev dependencies...`);
      await installDependencies(component.devDependencies, true);
    }

    // Write component files
    const componentBasePath = options.path ?? config.aliases.components;
    let filesWritten = 0;
    let filesSkipped = 0;
    let filesMerged = 0;

    for (const file of component.files) {
      // // Construct proper target path
      let targetPath: string;

      if (component.type === "registry:lib") {
        // Utils go to the configured utils path
        targetPath = join(
          options.cwd ?? process.cwd(),
          config.aliases.utils,
          basename(file.name) // Just the filename (index.ts)
        );
      } else {
        // Components go to components path
        targetPath = join(
          options.cwd ?? process.cwd(),
          componentBasePath,
          file.name
        );
      }

      // Special handling for utils files
      if (isUtilsFile(targetPath)) {
        spinner && (spinner.text = `Checking utils file...`);

        const mergeResult = await mergeUtilsFile(
          targetPath,
          file.content,
          options.overwrite
        );

        if (mergeResult === "merged") {
          filesMerged++;
          logDebug("Merged utils functions into:", targetPath);
        } else if (mergeResult === "skipped") {
          filesSkipped++;
          logDebug("Utils file unchanged (all functions exist):", targetPath);
        } else {
          filesWritten++;
          logDebug("Created new utils file:", targetPath);
        }

        spinner &&
          (spinner.text = `Installing ${chalk.cyan(componentName)}...`);
        continue;
      }

      // Regular file handling
      if (existsSync(targetPath) && !options.overwrite) {
        logDebug("File exists, skipping:", targetPath);
        filesSkipped++;
        continue;
      }

      ensureDirectory(targetPath);
      writeFileSync(targetPath, file.content, "utf-8");
      logDebug("Wrote file:", targetPath);
      filesWritten++;
    }

    // Build status message
    const statusParts = [chalk.green(`${componentName}`)];

    if (filesWritten > 0) {
      statusParts.push(chalk.gray(`(${filesWritten} new)`));
    }
    if (filesMerged > 0) {
      statusParts.push(chalk.blue(`[${filesMerged} merged]`));
    }
    if (filesSkipped > 0) {
      statusParts.push(chalk.yellow(`[${filesSkipped} skipped]`));
    }

    const statusMsg = statusParts.join(" ");

    spinner?.succeed(statusMsg);

    // Show contributor credit after successful install
    if (!options.silent && component.meta?.contributor) {
      displayContributorCredit(component);
    }

    return true;
  } catch (error) {
    spinner?.fail(chalk.red(`✗ Failed: ${componentName}`));

    if (error instanceof Error) {
      // Check if it's a 404 (component not found)
      if (error.message.includes("not found")) {
        logDebug(`Component not found for ${framework}`);
        // Return false to trigger suggestions later
        return false;
      }

      console.error(chalk.red(`  ${error.message}`));
    }

    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMMAND                                 */
/* -------------------------------------------------------------------------- */

export async function addComponent(
  components: string[],
  options: AddOptions = {}
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  // Enable debug mode
  if (options.debug) {
    DEBUG = true;
    logDebug("Debug mode enabled");
  }

  // Validate input
  if (!components.length) {
    console.error(chalk.red("\n✗ No components specified"));
    console.log(chalk.gray("  Usage: clipmotion add <component-name>\n"));
    process.exit(1);
  }

  // Show intro
  if (!options.silent) {
    console.log(
      chalk.blue(
        `\n🎬 Installing ${components.length} component${
          components.length > 1 ? "s" : ""
        }...\n`
      )
    );
  }

  // Load configuration
  logDebug("Loading configuration from:", cwd);
  const config = loadConfig(cwd);

  // Determine framework to use
  let targetFramework = config.framework;

  if (options.framework) {
    if (!validateFramework(options.framework)) {
      console.error(chalk.red(`\n✗ Invalid framework: ${options.framework}`));
      console.log(chalk.gray("  Valid options: nextjs, react, vue, angular\n"));
      process.exit(1);
    }

    targetFramework = options.framework as Framework;

    if (!options.silent) {
      console.log(
        chalk.blue(
          `\n🎬 Installing for ${chalk.bold(
            targetFramework
          )} (overriding config)\n`
        )
      );
    }
  } else if (!options.silent) {
    console.log(
      chalk.blue(
        `\n🎬 Installing ${components.length} component${
          components.length > 1 ? "s" : ""
        } for ${chalk.bold(targetFramework)}...\n`
      )
    );
  }

  logDebug("Configuration loaded:");
  logDebug("  Framework:", config.framework);
  logDebug("  Components path:", config.aliases.components);
  logDebug("  Utils path:", config.aliases.utils);

  // Create installation context
  const spinner = options.silent ? null : ora();
  const context: InstallContext = {
    installed: new Set<string>(),
    config,
    framework: targetFramework,
    options,
    spinner,
  };

  // Install components
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    notFound: [] as string[],
  };

  const registryUrl = getRegistryUrl(config, options.local);

  for (const componentName of components) {
    const success = await installSingleComponent(componentName, context);
    if (success) {
      results.success++;
    } else {
      results.failed++;
      results.notFound.push(componentName);
    }
  }

  // Show summary
  if (!options.silent) {
    console.log(); // Empty line

    if (results.failed === 0) {
      console.log(
        chalk.green.bold("✨ All components installed successfully!")
      );

      if (context.installed.size > components.length) {
        console.log(
          chalk.gray(
            `  (including ${context.installed.size - components.length} ${
              context.installed.size - components.length === 1
                ? "dependency"
                : "dependencies"
            })`
          )
        );
      }
    } else {
      console.log(
        chalk.yellow.bold(
          `⚠ Completed with ${results.failed} error${
            results.failed > 1 ? "s" : ""
          }`
        )
      );
      console.log(
        chalk.gray(`  ${results.success} succeeded, ${results.failed} failed`)
      );
    }

    // ✅ Suggest alternative frameworks for failed components
    if (results.notFound.length > 0) {
      console.log(chalk.yellow("\n💡 Suggestions:\n"));

      for (const componentName of results.notFound) {
        const available = await getAvailableFrameworks(
          componentName,
          registryUrl
        );

        if (available.length > 0) {
          console.log(
            chalk.gray(
              `  "${componentName}" is not available for ${chalk.bold(
                targetFramework
              )}`
            )
          );
          console.log(
            chalk.gray(
              `  But it's available for: ${available
                .map((fw) => chalk.cyan(fw))
                .join(", ")}`
            )
          );
          console.log(
            chalk.green(
              `  Try: clipmotion add ${componentName} --framework=${available[0]}\n`
            )
          );
        } else {
          console.log(
            chalk.gray(
              `  "${componentName}" is not available in any framework yet`
            )
          );
          console.log(
            chalk.gray(
              `  Request it: https://github.com/nerdboi008/clipmotion/issues/new?template=animation-request.md\n`
            )
          );
        }
      }
    }

    console.log(); // Empty line
  }

  // Exit with appropriate code
  if (results.failed > 0) {
    process.exit(1);
  }
}
