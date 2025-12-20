import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { execa } from "execa";
import { select, intro, confirm, log, outro, spinner } from "@clack/prompts";
import type { Framework, PackageManager, InitConfig as Config } from "./types.js";

/* -------------------------------------------------------------------------- */
/*                              FRAMEWORK DETECT                              */
/* -------------------------------------------------------------------------- */

function detectFramework(): Framework | null {
  const cwd = process.cwd();

  // Check for Next.js config files
  const nextConfigs = ["next.config.js", "next.config.mjs", "next.config.ts"];
  if (nextConfigs.some((config) => existsSync(join(cwd, config)))) {
    return "nextjs";
  }

  // Check for Angular
  if (existsSync(join(cwd, "angular.json"))) {
    return "angular";
  }

  // Check package.json for dependencies
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Priority order matters
      if (deps.next) return "nextjs";
      if (deps.vue) return "vue";
      if (deps.react) return "react";
    } catch (error) {
      log.warn(chalk.yellow("Failed to parse package.json"));
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                         DEPENDENCY INSTALLER                                */
/* -------------------------------------------------------------------------- */

function detectPackageManager(): PackageManager {
  const cwd = process.cwd();
  
  if (existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  
  return "npm";
}

async function installDeps(deps: string[]): Promise<void> {
  if (!deps.length) return;

  const pm = detectPackageManager();
  const s = spinner();
  
  s.start(chalk.blue(`Installing dependencies with ${pm}...`));

  try {
    const commands: Record<PackageManager, string[]> = {
      npm: ["install", ...deps],
      yarn: ["add", ...deps],
      pnpm: ["add", ...deps],
      bun: ["add", ...deps],
    };

    await execa(pm, commands[pm], { 
      stdio: "pipe", // Change to pipe for cleaner output
      cwd: process.cwd() 
    });

    s.stop(chalk.green(`Dependencies installed successfully`));
  } catch (error) {
    s.stop(chalk.red(`✗ Failed to install dependencies`));
    log.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*                            PATH VALIDATION                                 */
/* -------------------------------------------------------------------------- */

function getDefaultPaths(framework: Framework): Config["aliases"] {
  const pathMap: Record<Framework, Config["aliases"]> = {
    nextjs: {
      components: "components",
      utils: "components/utils",
    },
    react: {
      components: "components",
      utils: "components/utils",
    },
    vue: {
      components: "components",
      utils: "utils",
    },
    angular: {
      components: "app/components",
      utils: "app/components/utils",
    },
  };

  return pathMap[framework];
}

function ensureDirectories(paths: Config["aliases"]): void {
  Object.values(paths).forEach((path) => {
    const fullPath = join(process.cwd(), path);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      log.success(chalk.gray(`Created directory: ${path}`));
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                              CONFIG BUILDER                                */
/* -------------------------------------------------------------------------- */

function buildConfig(framework: Framework): Config {
  return {
    $schema: "https://clipmotion.dev/schema.json",
    framework,
    aliases: getDefaultPaths(framework),
    registry: {
      baseUrl:
        "https://raw.githubusercontent.com/nerdboi008/clipmotion/main/public/r",
    },
  };
}

function getFrameworkDeps(framework: Framework): string[] {
  const depsMap: Record<Framework, string[]> = {
    nextjs: ["clsx", "tailwind-merge"],
    react: ["clsx", "tailwind-merge"],
    vue: ["clsx"],
    angular: [],
  };

  return depsMap[framework];
}

/* -------------------------------------------------------------------------- */
/*                                   INIT                                     */
/* -------------------------------------------------------------------------- */

export async function init(): Promise<void> {
  intro(chalk.bold.blue("🎬 ClipMotion Setup"));

  const configPath = join(process.cwd(), "clipmotion-components.json");

  // Check if config already exists
  if (existsSync(configPath)) {
    const overwrite = await confirm({
      message: chalk.yellow(
        "Configuration file already exists. Do you want to overwrite it?"
      ),
      initialValue: false,
    });

    if (!overwrite) {
      outro(chalk.gray("Setup cancelled."));
      process.exit(0);
    }
  }

  // Framework detection
  const detectedFramework = detectFramework();
  let framework: Framework;

  if (detectedFramework) {
    log.success(
      chalk.green(`Auto-detected framework: ${chalk.bold(detectedFramework)}`)
    );
    
    const useDetected = await confirm({
      message: `Use ${detectedFramework}?`,
      initialValue: true,
    });

    if (useDetected) {
      framework = detectedFramework;
    } else {
      framework = await promptFramework();
    }
  } else {
    log.warn(chalk.yellow("⚠ Could not auto-detect framework"));
    framework = await promptFramework();
  }

  // Build and save config
  const config = buildConfig(framework);

  log.info(
    chalk.gray(
      [
        "Configuration:",
        `  Framework: ${framework}`,
        `  Components: ${config.aliases.components}`,
        `  Utils: ${config.aliases.utils}`,
      ].join("\n")
    ) +
      chalk.yellow(
        `\n\n💡 Tip: Utils are inside components/ to avoid conflicts with existing lib/utils`
      )
  );
  
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    log.success(chalk.green("Configuration saved"));
  } catch (error) {
    log.error(chalk.red("Failed to save configuration"));
    throw error;
  }

  // Create directories
  ensureDirectories(config.aliases);

  // Install dependencies
  const deps = getFrameworkDeps(framework);
  if (deps.length > 0) {
    log.step(chalk.blue("Installing required dependencies..."));
    await installDeps(deps);
  }

  // Success message
  outro(
    chalk.green.bold("✨ Setup complete!") +
      chalk.gray("\n\nNext steps:") +
      chalk.cyan("\n  clipmotion add <component-name>") +
      chalk.gray("\n  or") +
      chalk.cyan("\n  clipmotion find <video-url>\n")
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

async function promptFramework(): Promise<Framework> {
  return (await select({
    message: "Select your framework:",
    options: [
      { value: "nextjs", label: "Next.js", hint: "Recommended" },
      { value: "react", label: "React (Vite/CRA)" },
      { value: "vue", label: "Vue 3" },
      { value: "angular", label: "Angular" },
    ],
    initialValue: "nextjs",
  })) as Framework;
}