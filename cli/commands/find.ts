import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import ora from "ora";
import { select, confirm } from "@clack/prompts";
import { addComponent } from "./add.js";
import type {
  Framework,
  FindOptions,
  ComponentConfig,
  RegistryEntry,
  RegistryIndex,
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

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove tracking parameters and trailing slashes
    urlObj.search = "";
    urlObj.hash = "";
    return urlObj.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

function loadConfig(cwd: string): ComponentConfig | null {
  const configPath = join(cwd, "clipmotion-components.json");

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as ComponentConfig;
  } catch (error) {
    logError("Failed to parse configuration file", error as Error);
    return null;
  }
}

function getRegistryUrl(config: ComponentConfig | null): string {
  return config?.registry?.baseUrl || DEFAULT_REGISTRY_URL;
}

/* -------------------------------------------------------------------------- */
/*                              REGISTRY FETCH                                */
/* -------------------------------------------------------------------------- */

async function fetchRegistryIndex(registryUrl: string): Promise<RegistryIndex> {
  const url = `${registryUrl}/index.json`;

  logDebug("Fetching registry index from:", url);

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    logDebug("Registry index fetched successfully");

    return data as RegistryIndex;
  } catch (error) {
    throw new Error(
      `Failed to fetch registry index: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function findAnimationByUrl(
  registry: RegistryIndex,
  videoUrl: string
): RegistryEntry | null {
  const normalizedUrl = normalizeUrl(videoUrl);
  logDebug("Searching for URL:", normalizedUrl);

  return (
    registry.animations.find((anim) =>
      anim.sources.some((source) => normalizeUrl(source) === normalizedUrl)
    ) || null
  );
}

function findSimilarAnimations(
  registry: RegistryIndex,
  searchUrl: string
): RegistryEntry[] {
  const domain = new URL(searchUrl).hostname.replace("www.", "");

  return registry.animations.filter((anim) =>
    anim.sources.some((source) => {
      try {
        const sourceDomain = new URL(source).hostname.replace("www.", "");
        return sourceDomain === domain;
      } catch {
        return false;
      }
    })
  );
}

/* -------------------------------------------------------------------------- */
/*                              USER INTERACTION                              */
/* -------------------------------------------------------------------------- */

async function showAnimationDetails(
  animation: RegistryEntry,
  framework: Framework | null
): Promise<void> {
  console.log(chalk.bold.cyan(`\n✨ ${animation.name}`));
  console.log(chalk.gray(animation.description));

  console.log(chalk.blue(`\n🎯 Difficulty: ${animation.difficulty}`));
  console.log(
    chalk.cyan(`📦 Available for: ${animation.libraries.join(", ")}`)
  );

  if (animation.tags.length > 0) {
    console.log(chalk.gray(`🏷️  Tags: ${animation.tags.join(", ")}`));
  }

  if (framework && !animation.libraries.includes(framework)) {
    console.log(
      chalk.yellow(`\n⚠️  This component is not available for ${framework}`)
    );
    console.log(
      chalk.gray(`   Available frameworks: ${animation.libraries.join(", ")}`)
    );
  }
}

async function promptUserAction(
  animation: RegistryEntry,
  framework: Framework | null,
  options: FindOptions
): Promise<"install" | "demo" | "guide" | "exit"> {
  // Auto-install if flag is set
  if (options.install) {
    return "install";
  }

  const choices = [
    { value: "install" as const, label: "Install this component" },
    ...(animation.demoUrl
      ? [{ value: "demo" as const, label: "View live demo" }]
      : []),
    { value: "guide" as const, label: "Show implementation guide" },
    { value: "exit" as const, label: "Exit" },
  ];

  const action = await select({
    message: "What would you like to do?",
    options: choices,
    initialValue: "install",
  });

  return action as "install" | "demo" | "guide" | "exit";
}

function showImplementationGuide(
  animation: RegistryEntry,
  framework: Framework | null
): void {
  console.log(chalk.bold.cyan("\n📖 Implementation Guide\n"));

  console.log(`${chalk.gray("1.")} Install the component:`);
  console.log(chalk.green(`   clipmotion add ${animation.id}`));

  console.log(`\n${chalk.gray("2.")} Import in your code:`);
  console.log(
    chalk.gray(
      `   import { ${toPascalCase(animation.id)} } from '@/components/${
        animation.id
      }'`
    )
  );

  console.log(`\n${chalk.gray("3.")} If using utilities:`);
  console.log(chalk.gray(`   import { cn } from '@/components/utils'`));

  console.log(`\n${chalk.gray("4.")} Use it:`);
  console.log(chalk.gray(`   <${toPascalCase(animation.id)} />`));

  if (animation.demoUrl) {
    console.log(chalk.blue(`\n📚 Live demo: ${animation.demoUrl}`));
  }

  console.log(
    chalk.gray(`\n💡 Full docs: https://clipmotion.dev/docs/${animation.id}\n`)
  );
}

function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMMAND                                 */
/* -------------------------------------------------------------------------- */

export async function findComponent(
  videoUrl: string,
  options: FindOptions = {}
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  // Enable debug mode
  if (options.debug) {
    DEBUG = true;
    logDebug("Debug mode enabled");
  }

  console.log(chalk.blue("\n🔍 Searching for animation...\n"));

  // Validate URL
  try {
    new URL(videoUrl);
  } catch {
    console.error(chalk.red("✗ Invalid URL provided"));
    console.log(chalk.gray("  Please provide a valid video URL\n"));
    process.exit(1);
  }

  const spinner = ora("Fetching registry...").start();

  try {
    // Load config (optional, may not exist yet)
    const config = loadConfig(cwd);
    const framework = config?.framework || null;

    logDebug("Project framework:", framework || "not configured");

    // Fetch registry
    const registryUrl = getRegistryUrl(config);
    const registry = await fetchRegistryIndex(registryUrl);

    // Search for animation
    const animation = findAnimationByUrl(registry, videoUrl);

    spinner.stop();

    if (!animation) {
      console.log(chalk.yellow("⚠️  Animation not found in registry\n"));

      // Show similar animations
      const similar = findSimilarAnimations(registry, videoUrl);

      if (similar.length > 0) {
        console.log(
          chalk.cyan("🔍 Similar animations from the same platform:\n")
        );
        similar.slice(0, 3).forEach((anim) => {
          console.log(chalk.gray(`  • ${anim.name}`));
        });
        console.log();
      }

      // Offer to create request
      const shouldRequest = await confirm({
        message: "Would you like to request this animation?",
        initialValue: true,
      });

      if (shouldRequest) {
        console.log(chalk.cyan("\n📝 Creating animation request..."));
        console.log(
          chalk.gray(
            "  Open an issue at: https://github.com/nerdboi008/clipmotion/issues/new"
          )
        );
        console.log(chalk.gray(`  Video URL: ${videoUrl}\n`));
      }

      return;
    }

    // Animation found!
    console.log(chalk.green("✓ Animation found!\n"));
    await showAnimationDetails(animation, framework);

    // Prompt for action
    const action = await promptUserAction(animation, framework, options);

    switch (action) {
      case "install":
        // Check if framework matches
        if (framework && !animation.libraries.includes(framework)) {
          console.log(
            chalk.red(
              `\n✗ Cannot install: Component not available for ${framework}`
            )
          );
          return;
        }

        if (!framework) {
          console.log(chalk.yellow("\n⚠️  Project not initialized"));
          console.log(chalk.gray("  Run: clipmotion init\n"));
          return;
        }

        // Install component
        console.log();
        await addComponent([animation.id], {
          ...options,
          silent: false,
        });
        break;

      case "demo":
        if (animation.demoUrl) {
          console.log(chalk.cyan(`\n🌐 ${animation.demoUrl}\n`));
        }
        break;

      case "guide":
        showImplementationGuide(animation, framework);
        break;

      case "exit":
        console.log(chalk.gray("\nExiting...\n"));
        break;
    }
  } catch (error) {
    spinner.fail(chalk.red("Failed to search for animation"));
    logError("Search error", error as Error);
    process.exit(1);
  }
}
