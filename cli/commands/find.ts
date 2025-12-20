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
/*                                   CONSTANTS                                */
/* -------------------------------------------------------------------------- */

const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/nerdboi008/clipmotion/main/public/r";

let DEBUG = false;

/* -------------------------------------------------------------------------- */
/*                                     UTILS                                  */
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
    urlObj.search = "";
    urlObj.hash = "";
    return urlObj.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

function loadConfig(cwd: string): ComponentConfig | null {
  const configPath = join(cwd, "clipmotion-components.json");

  logDebug("Looking for config at:", configPath);

  if (!existsSync(configPath)) {
    logDebug("Config file not found, proceeding without it");
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content) as ComponentConfig;
    logDebug("Config loaded:", parsed);
    return parsed;
  } catch (error) {
    logError("Failed to parse configuration file", error as Error);
    return null;
  }
}

function getRegistryUrl(
  config: ComponentConfig | null,
  isLocal: boolean
): string {
  if (isLocal) {
    logDebug("Local mode - using local registry");
    return ""; // Not used in local mode
  }
  const url = config?.registry?.baseUrl || DEFAULT_REGISTRY_URL;
  logDebug("Using remote registry URL:", url);
  return url;
}

/* -------------------------------------------------------------------------- */
/*                               REGISTRY FETCH                               */
/* -------------------------------------------------------------------------- */

async function fetchRegistryIndex(
  registryUrl: string,
  isLocal: boolean
): Promise<RegistryIndex> {
  // LOCAL MODE: Read from public/r/index.json
  if (isLocal) {
    const indexPath = join(
      __dirname,
      "..", // build
      "public",
      "r",
      "index.json"
    );
    logDebug("Local mode - reading from:", indexPath);

    if (!existsSync(indexPath)) {
      throw new Error("Local registry not found. Run: npm run registry:build");
    }

    const text = readFileSync(indexPath, "utf-8");
    try {
      const data = JSON.parse(text);
      logDebug("Local index.json parsed successfully");
      return data as RegistryIndex;
    } catch (error) {
      throw new Error(
        `Failed to parse local index.json: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // REMOTE MODE: fetch logic
  const url = `${registryUrl}/index.json`;
  logDebug("Fetching registry index from:", url);

  const res = await fetch(url);
  logDebug("Registry index HTTP status:", res.status, res.statusText);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();

  try {
    const data = JSON.parse(text);
    logDebug("Registry index parsed successfully");
    return data as RegistryIndex;
  } catch (error) {
    logDebug("Raw index.json content:", text.slice(0, 500));
    throw new Error(
      `Failed to parse registry index JSON: ${
        error instanceof Error ? error.message : String(error)
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

  const match =
    registry.animations.find((anim) =>
      anim.sources.some((source) => normalizeUrl(source) === normalizedUrl)
    ) || null;

  if (match) {
    logDebug("Exact match found:", match.id);
  } else {
    logDebug("No exact match found for URL");
  }

  return match;
}

function findSimilarAnimations(
  registry: RegistryIndex,
  searchUrl: string
): RegistryEntry[] {
  let domain: string;
  try {
    domain = new URL(searchUrl).hostname.replace("www.", "");
  } catch {
    logDebug("Failed to parse domain from search URL:", searchUrl);
    return [];
  }

  logDebug("Looking for animations from domain:", domain);

  const results = registry.animations.filter((anim) =>
    anim.sources.some((source) => {
      try {
        const sourceDomain = new URL(source).hostname.replace("www.", "");
        return sourceDomain === domain;
      } catch {
        return false;
      }
    })
  );

  logDebug(`Found ${results.length} similar animations for domain ${domain}`);

  return results;
}

/* -------------------------------------------------------------------------- */
/*                            USER INTERACTION                                */
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
      chalk.yellow(`\n⚠  This component is not available for ${framework}`)
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
  if (options.install) {
    logDebug("Auto-install flag set, skipping action prompt");
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

  logDebug("User selected action:", action);

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

  if (options.debug) {
    DEBUG = true;
    logDebug("Debug mode enabled");
  }

  // if (options.local) {
  //   logDebug("Local development mode enabled");
  //   // Validate we're in ClipMotion repo
  //   const clipmotionPath = join(process.cwd(), "public/r");
  //   if (!existsSync(clipmotionPath)) {
  //     console.error(chalk.red("✗ Local mode requires ClipMotion repo"));
  //     console.log(
  //       chalk.gray(
  //         `  Run from ClipMotion root or: npm run registry:build first\n`
  //       )
  //     );
  //     return;
  //   }
  // }

  console.log(chalk.blue("\n🔍 Searching for animation...\n"));
  logDebug("Search URL:", videoUrl);
  logDebug("CWD:", cwd);

  // Validate URL
  try {
    new URL(videoUrl);
  } catch {
    console.error(chalk.red("✗ Invalid URL provided"));
    console.log(chalk.gray("  Please provide a valid video URL\n"));
    return;
  }

  const spinner = ora("Fetching registry...").start();

  try {
    const config = loadConfig(cwd);
    const framework = config?.framework || null;
    logDebug("Project framework:", framework || "not configured");

    const registry = await fetchRegistryIndex(
      getRegistryUrl(config, options.local ?? false),
      options.local ?? false
    );
    // const registryUrl = getRegistryUrl(config);

    spinner.stop();

    // Validate registry structure
    if (!registry || !Array.isArray(registry.animations)) {
      logDebug("Registry missing animations array:", registry);
      console.log(chalk.yellow("⚠  No animations found in registry\n"));

      if (options.local) {
        console.log(
          chalk.gray("  Tip: Run `npm run registry:build` to regenerate\n")
        );
      }
      return;
    }

    const animation = findAnimationByUrl(registry, videoUrl);

    if (!animation) {
      console.log(chalk.yellow("⚠  Animation not found in registry\n"));

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

      const shouldRequest = await confirm({
        message: "Would you like to request this animation?",
        initialValue: true,
      });

      if (shouldRequest) {
        console.log(chalk.cyan("\n📝 Creating animation request..."));
        console.log(
          chalk.gray(
            "  Open an issue at: https://github.com/nerdboi008/clipmotion/issues/new?template=animation-request.md"
          )
        );
        console.log(chalk.gray(`  Video URL: ${videoUrl}\n`));
      }

      return;
    }

    console.log(chalk.green("✓ Animation found!\n"));
    logDebug("Matched animation id:", animation.id);
    await showAnimationDetails(animation, framework);

    const action = await promptUserAction(animation, framework, options);

    switch (action) {
      case "install": {
        if (framework && !animation.libraries.includes(framework)) {
          console.log(
            chalk.red(
              `\n✗ Cannot install: Component not available for ${framework}`
            )
          );
          console.log(
            chalk.gray(
              `  Available frameworks: ${animation.libraries.join(", ")}\n`
            )
          );
          return;
        }

        if (!framework) {
          console.log(chalk.yellow("\n⚠  Project not initialized"));
          console.log(chalk.gray("  Run: clipmotion init\n"));
          return;
        }

        console.log();
        await addComponent([animation.id], {
          ...options,
          silent: false,
          local: options.local ?? false,
        });
        break;
      }

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
    spinner.stop();
    console.error(chalk.red("✖ Failed to search for animation"));
    logError("Search error", error as Error);
    console.log(
      chalk.gray(
        "  Tip: run again with --debug to see more details, e.g. `clipmotion find <url> --debug`\n"
      )
    );
    return;
  }
}
