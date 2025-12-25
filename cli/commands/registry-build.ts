import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from "fs";
import { join, basename, extname, relative, dirname } from "path";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import { registryItemSchema, type RegistryItem } from "../registry-schema.js";
import type { ContributorInfo, BuildStats, ComponentType } from "./types.js";

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

const VALID_EXTENSIONS = [".tsx", ".ts", ".vue", ".jsx", ".js"] as const;

const FRAMEWORK_DEPENDENCIES: Record<string, string> = {
  nextjs: "next",
  react: "react",
  vue: "vue",
  angular: "@angular/core",
};

const IGNORED_DIRS = ["node_modules", ".git", "dist", "build", "__tests__"];

const COMPONENT_TYPE_MAP: Record<string, ComponentType> = {
  ui: "registry:component",
  lib: "registry:lib",
  hooks: "registry:hook",
};

/* -------------------------------------------------------------------------- */
/*                                FILE UTILS                                  */
/* -------------------------------------------------------------------------- */

export function safeStatSync(path: string) {
  return statSync(path);
}

function isValidComponentFile(filename: string): boolean {
  const ext = extname(filename);
  return VALID_EXTENSIONS.includes(ext as any);
}

function ensureDirectory(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function logError(message: string, error?: Error): void {
  if (error) {
    console.error(chalk.red(`✗ ${message}`), error);
  } else {
    console.error(chalk.red(`✗ ${message}`));
  }
}

function fatal(message: string, details?: string): never {
  console.error(chalk.red(`✗ ${message}`));
  if (details) {
    console.error(chalk.gray(`  ${details}`));
  }
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*                            METADATA EXTRACTION                             */
/* -------------------------------------------------------------------------- */

function extractContributorInfo(content: string): ContributorInfo | undefined {
  const authorMatch = content.match(/@author\s+(.+)/);
  const githubMatch = content.match(/@github\s+(https?:\/\/[^\s]+)/);
  const xMatch = content.match(/@x\s+(https?:\/\/[^\s]+)/);
  const websiteMatch = content.match(/@website\s+(https?:\/\/[^\s]+)/);

  if (!authorMatch && !githubMatch && !xMatch && !websiteMatch) {
    return undefined;
  }

  return {
    name: authorMatch?.[1]?.trim()!,
    github: githubMatch?.[1]?.trim()!,
    x: xMatch?.[1]?.trim()!,
    website: websiteMatch?.[1]?.trim()!,
  };
}

function extractMetadata(content: string, filePath: string) {
  const descriptionMatch = content.match(/@description\s+(.+)/);
  const categoryMatch = content.match(/@category\s+(.+)/);
  const contributor = extractContributorInfo(content);

  const meta: {
    source: string;
    category?: string;
    contributor?: ContributorInfo;
  } = {
    source: relative(process.cwd(), filePath),
  };

  if (categoryMatch?.[1]?.trim()) {
    meta.category = categoryMatch[1].trim();
  }

  if (contributor) {
    meta.contributor = contributor;
  }

  return {
    description: descriptionMatch?.[1]?.trim(),
    meta,
  };
}

/* -------------------------------------------------------------------------- */
/*                           DEPENDENCY EXTRACTION                            */
/* -------------------------------------------------------------------------- */

function extractPackageFromImport(importPath: string): string | null {
  // Skip relative imports and path aliases
  if (importPath?.startsWith(".") || importPath?.startsWith("@/")) {
    return null;
  }

  // Extract package name (handle scoped packages)
  return importPath?.startsWith("@")
    ? importPath.split("/").slice(0, 2).join("/")
    : importPath?.split("/")[0] || null;
}

function extractDependencies(content: string, framework: string): string[] {
  const dependencies = new Set<string>();

  // Add framework base dependency
  const baseDep = FRAMEWORK_DEPENDENCIES[framework];
  if (baseDep) {
    dependencies.add(baseDep);
  }

  // Extract imports using multiple patterns
  const importPatterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(['"]([^'"]+)['"]\)/g,
    /import\s*\(['"]([^'"]+)['"]\)/g,
  ];

  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const packageName = extractPackageFromImport(match[1]!);
      if (packageName) {
        dependencies.add(packageName);
      }
    }
  }

  return Array.from(dependencies).sort();
}

function extractDevDependencies(content: string): string[] {
  const devDeps = new Set<string>();
  const devPatterns = [/@testing-library/, /vitest/, /jest/, /@types\//];

  for (const pattern of devPatterns) {
    if (pattern.test(content)) {
      const match = content.match(
        new RegExp(`from ['"]([^'"]*${pattern.source}[^'"]*)['"]`)
      );
      if (match) {
        const pkg = extractPackageFromImport(match[1]!);
        if (pkg) {
          devDeps.add(pkg);
        }
      }
    }
  }

  return Array.from(devDeps).sort();
}

function extractRegistryDependencies(content: string): string[] {
  const deps = new Set<string>();

  // Check for common utility imports
  const utilPatterns = [
    { regex: /from ["']@\/components\/utils["']/g, dep: "utils" },
    { regex: /from ["']@\/lib\/utils["']/g, dep: "utils" },
  ];

  for (const { regex, dep } of utilPatterns) {
    if (regex.test(content)) {
      deps.add(dep);
    }
  }

  // Extract specific component imports
  const componentImportRegex = /from ["']@\/components\/([^"'\/]+)["']/g;
  let match;
  while ((match = componentImportRegex.exec(content)) !== null) {
    if (match[1] && match[1] !== "utils") {
      deps.add(match[1]);
    }
  }

  return Array.from(deps).sort();
}

/* -------------------------------------------------------------------------- */
/*                            IMPORT TRANSFORMATION                           */
/* -------------------------------------------------------------------------- */

function transformImports(content: string): string {
  return content
    .replace(/from\s+['"](\.\.\/lib\/utils)['"]/g, 'from "@/components/utils"')
    .replace(/from\s+['"](\.\.\/lib\/([^'"]+))['"]/g, 'from "@/components/$2"');
}

/* -------------------------------------------------------------------------- */
/*                         REGISTRY ITEM CREATION                             */
/* -------------------------------------------------------------------------- */

function determineTargetFileName(file: string, type: ComponentType): string {
  const componentName = basename(file, extname(file));
  const ext = extname(file);

  if (type === "registry:lib") {
    return `${componentName}/index${ext}`;
  }

  return file;
}

function createRegistryItem(
  file: string,
  filePath: string,
  framework: string,
  type: ComponentType
): RegistryItem | null {
  try {
    const componentName = basename(file, extname(file));
    const fileContent = readFileSync(filePath, "utf-8");
    const transformedContent = transformImports(fileContent);

    const { description, meta } = extractMetadata(fileContent, filePath);
    const targetFileName = determineTargetFileName(file, type);

    const rawItem = {
      name: componentName,
      type,
      framework: framework as any, // Let Zod handle the actual validation
      description:
        description ||
        `${componentName} ${type.split(":")[1]} for ${framework}`,
      files: [
        {
          name: targetFileName,
          content: transformedContent,
          type: type, // Added type field often expected in registry schemas
        },
      ],
      dependencies: extractDependencies(transformedContent, framework),
      devDependencies: extractDevDependencies(transformedContent),
      registryDependencies: extractRegistryDependencies(transformedContent),
      meta,
    };

    const result = registryItemSchema.safeParse(rawItem);

    if (!result.success) {
      console.error(
        chalk.red(`\n❌ Schema Validation Error in: ${chalk.bold(file)}`)
      );

      // Map through Zod issues for a clean output
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        console.error(
          chalk.yellow(`  → [${path}]: `) + chalk.white(issue.message)
        );
      });

      // Since we want to "catch errors before push," we exit 1 to fail the build/CI
      process.exit(1);
    }

    return result.data as RegistryItem;
  } catch (error) {
    logError(`Failed to process ${file}`, error as Error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                            FILE/DIR PROCESSING                             */
/* -------------------------------------------------------------------------- */

function processFile(
  file: string,
  dir: string,
  outputDir: string,
  framework: string,
  type: ComponentType
): boolean {
  const filePath = join(dir, file);

  // Check if it's a valid file
  try {
    const stat = __test__.safeStatSync(filePath);
    if (stat.isDirectory() || !isValidComponentFile(file)) {
      return false;
    }
  } catch (error) {
    logError(`Failed to stat ${file}`, error as Error);
    return false;
  }

  // Create and write registry item
  const registryItem = createRegistryItem(file, filePath, framework, type);
  if (!registryItem) {
    return false;
  }

  const componentName = basename(file, extname(file));
  const outputPath = join(outputDir, `${componentName}.json`);

  try {
    ensureDirectory(dirname(outputPath));
    writeFileSync(outputPath, JSON.stringify(registryItem, null, 2), "utf-8");
    return true;
  } catch (error) {
    logError(`Failed to write ${outputPath}`, error as Error);
    return false;
  }
}

function processDirectory(
  dir: string,
  outputDir: string,
  framework: string,
  type: ComponentType,
  spinner: Ora
): number {
  if (!existsSync(dir)) {
    return 0;
  }

  let processed = 0;
  const files = readdirSync(dir);

  for (const file of files) {
    spinner.text = `Processing ${chalk.cyan(framework)}/${chalk.gray(file)}...`;

    if (processFile(file, dir, outputDir, framework, type)) {
      processed++;
    }
  }

  return processed;
}

/* -------------------------------------------------------------------------- */
/*                          FRAMEWORK PROCESSING                              */
/* -------------------------------------------------------------------------- */

interface FrameworkStats {
  components: number;
  utilities: number;
}

function processFramework(
  framework: string,
  registryDir: string,
  outputDir: string,
  spinner: Ora
): FrameworkStats {
  const frameworkDir = join(registryDir, framework);
  const frameworkOutputDir = join(outputDir, framework);

  ensureDirectory(frameworkOutputDir);

  const stats: FrameworkStats = {
    components: 0,
    utilities: 0,
  };

  // Process UI components
  const uiDir = join(frameworkDir, "ui");
  if (existsSync(uiDir)) {
    stats.components = processDirectory(
      uiDir,
      frameworkOutputDir,
      framework,
      "registry:component",
      spinner
    );
  }

  // Process library utilities
  const libDir = join(frameworkDir, "lib");
  if (existsSync(libDir)) {
    stats.utilities = processDirectory(
      libDir,
      frameworkOutputDir,
      framework,
      "registry:lib",
      spinner
    );
  }

  // Process hooks
  const hooksDir = join(frameworkDir, "hooks");
  if (existsSync(hooksDir)) {
    const hooks = processDirectory(
      hooksDir,
      frameworkOutputDir,
      framework,
      "registry:hook",
      spinner
    );
    stats.utilities += hooks;
  }

  return stats;
}

/* -------------------------------------------------------------------------- */
/*                           FRAMEWORK DISCOVERY                              */
/* -------------------------------------------------------------------------- */

function isValidFrameworkDir(dir: string, registryDir: string): boolean {
  if (IGNORED_DIRS.includes(dir)) {
    return false;
  }

  const fullPath = join(registryDir, dir);

  try {
    const stat = safeStatSync(fullPath);
    if (!stat.isDirectory()) {
      return false;
    }

    // Check if it has at least one valid subdirectory
    return (
      existsSync(join(fullPath, "ui")) ||
      existsSync(join(fullPath, "lib")) ||
      existsSync(join(fullPath, "hooks"))
    );
  } catch {
    return false;
  }
}

function discoverFrameworks(registryDir: string): string[] {
  const allEntries = readdirSync(registryDir);
  return allEntries.filter((dir) => isValidFrameworkDir(dir, registryDir));
}

/* -------------------------------------------------------------------------- */
/*                             INDEX GENERATION                               */
/* -------------------------------------------------------------------------- */

function createAnimationIndex(
  framework: string,
  frameworkOutputDir: string
): any[] {
  if (!existsSync(frameworkOutputDir)) {
    return [];
  }

  const animations: any[] = [];
  const jsonFiles = readdirSync(frameworkOutputDir).filter((f) =>
    f.endsWith(".json")
  );

  for (const jsonFile of jsonFiles) {
    try {
      const filePath = join(frameworkOutputDir, jsonFile);
      const registryItem = JSON.parse(readFileSync(filePath, "utf-8"));

      animations.push({
        id: registryItem.name,
        name: registryItem.name,
        description: registryItem.description,
        libraries: [framework],
        sources: [registryItem.meta?.source || ""],
        difficulty: registryItem.meta?.difficulty || "medium",
        tags: registryItem.meta?.tags || [],
        demoUrl: registryItem.meta?.demoUrl || undefined,
      });
    } catch (error) {
      logError(`Failed to index ${jsonFile}`, error as Error);
    }
  }

  return animations;
}

function writeIndexFile(
  outputDir: string,
  frameworks: string[],
  stats: BuildStats,
  animations: any[]
): void {
  const indexPath = join(outputDir, "index.json");
  const indexData = {
    frameworks,
    stats: {
      totalComponents: stats.components,
      totalUtilities: stats.utilities,
      totalFrameworks: stats.frameworks,
    },
    lastUpdated: new Date().toISOString(),
    animations,
  };

  writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMMAND                                 */
/* -------------------------------------------------------------------------- */

export async function buildRegistry(): Promise<void> {
  const spinner = ora("Building registry...").start();

  try {
    const registryDir = join(process.cwd(), "registry");
    const outputDir = join(process.cwd(), "public/r");

    // Validate registry directory exists
    if (!existsSync(registryDir)) {
      spinner.fail(chalk.red("Registry directory not found"));
      fatal("Registry directory not found", `Expected: ${registryDir}`);
    }

    ensureDirectory(outputDir);

    // Discover frameworks
    const frameworks = discoverFrameworks(registryDir);
    if (frameworks.length === 0) {
      spinner.fail(chalk.red("No valid framework directories found"));
      fatal(
        "No valid framework directories found",
        "Expected structure: registry/<framework>/ui/"
      );
    }

    // Initialize stats
    const stats: BuildStats = {
      components: 0,
      utilities: 0,
      frameworks: frameworks.length,
      errors: 0,
    };

    const allAnimations: any[] = [];

    // Process each framework
    for (const framework of frameworks) {
      try {
        const frameworkStats = processFramework(
          framework,
          registryDir,
          outputDir,
          spinner
        );

        stats.components += frameworkStats.components;
        stats.utilities += frameworkStats.utilities;

        // Create animation index for this framework
        const frameworkOutputDir = join(outputDir, framework);
        const animations = createAnimationIndex(framework, frameworkOutputDir);
        allAnimations.push(...animations);
      } catch (error) {
        stats.errors++;
        logError(`Failed to process framework: ${framework}`, error as Error);
      }
    }

    // Write index file
    writeIndexFile(outputDir, frameworks, stats, allAnimations);

    // Show results
    spinner.succeed(chalk.green.bold("✨ Registry built successfully!"));

    console.log(chalk.gray("\n  Summary:"));
    console.log(chalk.cyan(`    Components: ${stats.components}`));
    console.log(chalk.cyan(`    Utilities: ${stats.utilities}`));
    console.log(chalk.cyan(`    Frameworks: ${stats.frameworks}`));

    if (stats.errors > 0) {
      console.log(chalk.yellow(`    Errors: ${stats.errors}`));
    }

    console.log(
      chalk.gray(`\n  Output: ${relative(process.cwd(), outputDir)}\n`)
    );
  } catch (error) {
    spinner.fail(chalk.red("Failed to build registry"));
    logError("Build error", error as Error);
    process.exit(1);
  }
}

export const __test__ = {
  safeStatSync,
  processFile,
};
