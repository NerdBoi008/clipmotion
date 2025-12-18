import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from "fs";
import { join, basename, extname, relative } from "path";
import chalk from "chalk";
import ora, { type Ora } from "ora";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

interface RegistryItem {
  name: string;
  type: string;
  description?: string;
  files: Array<{
    name: string;
    content: string;
  }>;
  dependencies: string[];
  devDependencies?: string[];
  registryDependencies: string[];
  meta?: {
    source?: string;
    category?: string;
  };
}

interface BuildStats {
  components: number;
  utilities: number;
  frameworks: number;
  errors: number;
}

type ComponentType = "registry:component" | "registry:lib" | "registry:hook";

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

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

function isValidComponentFile(filename: string): boolean {
  const ext = extname(filename);
  return VALID_EXTENSIONS.includes(ext as any);
}

function ensureDirectory(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getComponentType(dirName: string): ComponentType {
  const typeMap: Record<string, ComponentType> = {
    ui: "registry:component",
    lib: "registry:lib",
    hooks: "registry:hook",
  };
  
  return typeMap[dirName] || "registry:component";
}

function logError(message: string, error?: Error): void {
  console.error(chalk.red(`✗ ${message}`));
  if (error) {
    console.error(chalk.gray(`  ${error.message}`));
  }
}

/* -------------------------------------------------------------------------- */
/*                           DEPENDENCY EXTRACTION                            */
/* -------------------------------------------------------------------------- */

function extractDependencies(content: string, framework: string): string[] {
  const dependencies = new Set<string>();
  
  // Add framework base dependency
  const baseDep = FRAMEWORK_DEPENDENCIES[framework];
  if (baseDep) {
    dependencies.add(baseDep);
  }

  // Extract imports
  const importPatterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,           // ES6 imports
    /require\s*\(['"]([^'"]+)['"]\)/g,                    // CommonJS
    /import\s*\(['"]([^'"]+)['"]\)/g,                     // Dynamic imports
  ];

  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      
      // Skip relative imports and path aliases
      if (importPath?.startsWith(".") || importPath?.startsWith("@/")) {
        continue;
      }

      // Extract package name (handle scoped packages)
      const packageName = importPath?.startsWith("@")
        ? importPath.split("/").slice(0, 2).join("/")
        : importPath?.split("/")[0];

      if (packageName) {
        dependencies.add(packageName);
      }
    }
  }

  return Array.from(dependencies).sort();
}

function extractDevDependencies(content: string): string[] {
  const devDeps = new Set<string>();

  // Common dev-only imports
  const devPatterns = [
    /@testing-library/,
    /vitest/,
    /jest/,
    /@types\//,
  ];

  for (const pattern of devPatterns) {
    if (pattern.test(content)) {
      const match = content.match(new RegExp(`from ['"]([^'"]*${pattern.source}[^'"]*)['"]`));
      if (match) {
        const pkg = match[1]?.startsWith("@")
          ? match[1].split("/").slice(0, 2).join("/")
          : match[1]?.split("/")[0];
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

  // Common registry dependencies
  const patterns = [
    { regex: /from ["']@\/components\/utils["']/g, dep: "utils" },
    { regex: /from ["']@\/components\/utils\/cn["']/g, dep: "cn" },
    { regex: /from ["']@\/lib\/utils["']/g, dep: "utils" }, // Keep for backwards compat
  ];

  for (const { regex, dep } of patterns) {
    if (regex.test(content)) {
      deps.add(dep);
    }
  }

  // Extract specific utility imports from components folder
  const utilImportRegex = /from ["']@\/components\/([^"'\/]+)["']/g;
  let match;
  while ((match = utilImportRegex.exec(content)) !== null) {
    if (match[1] !== 'utils') { // Don't add 'utils' as a component
      deps.add(match[1]!);
    }
  }

  return Array.from(deps).sort();
}


/* -------------------------------------------------------------------------- */
/*                              FILE PROCESSING                               */
/* -------------------------------------------------------------------------- */

function createRegistryItem(
  file: string,
  filePath: string,
  framework: string,
  type: ComponentType
): RegistryItem | null {
  try {
    const componentName = basename(file, extname(file));
    const fileContent = readFileSync(filePath, "utf-8");

    // Extract metadata from comments (optional)
    const descriptionMatch = fileContent.match(/@description\s+(.+)/);
    const categoryMatch = fileContent.match(/@category\s+(.+)/);

    return {
      name: componentName,
      type,
      description:
        descriptionMatch?.[1]?.trim() ||
        `${componentName} ${type.split(":")[1]} for ${framework}`,
      files: [
        {
          name: file,
          content: fileContent,
        },
      ],
      dependencies: extractDependencies(fileContent, framework),
      devDependencies: extractDevDependencies(fileContent),
      registryDependencies: extractRegistryDependencies(fileContent),
      ...(descriptionMatch?.[1]?.trim() || categoryMatch?.[1]?.trim()
    ? {
        meta: {
          ...(categoryMatch?.[1]?.trim() && { category: categoryMatch[1].trim() }),
          source: relative(process.cwd(), filePath),
        },
      }
    : { meta: { source: relative(process.cwd(), filePath) } }),
    };
  } catch (error) {
    logError(`Failed to process ${file}`, error as Error);
    return null;
  }
}

function writeRegistryItem(
  item: RegistryItem,
  outputPath: string
): boolean {
  try {
    ensureDirectory(basename(outputPath));
    writeFileSync(outputPath, JSON.stringify(item, null, 2), "utf-8");
    return true;
  } catch (error) {
    logError(`Failed to write ${outputPath}`, error as Error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                           DIRECTORY PROCESSING                             */
/* -------------------------------------------------------------------------- */

async function processDirectory(
  dir: string,
  outputDir: string,
  framework: string,
  type: ComponentType,
  spinner: Ora
): Promise<number> {
  if (!existsSync(dir)) {
    return 0;
  }

  let processed = 0;
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    // Skip directories and invalid files
    if (stat.isDirectory()) {
      continue;
    }

    if (!isValidComponentFile(file)) {
      continue;
    }

    spinner.text = `Processing ${chalk.cyan(framework)}/${chalk.gray(file)}...`;

    const registryItem = createRegistryItem(file, filePath, framework, type);
    if (!registryItem) {
      continue;
    }

    const componentName = basename(file, extname(file));
    const outputPath = join(outputDir, `${componentName}.json`);

    if (writeRegistryItem(registryItem, outputPath)) {
      processed++;
    }
  }

  return processed;
}

async function processFramework(
  framework: string,
  registryDir: string,
  outputDir: string,
  spinner: Ora
): Promise<{ components: number; utilities: number }> {
  const frameworkDir = join(registryDir, framework);
  const frameworkOutputDir = join(outputDir, framework);

  ensureDirectory(frameworkOutputDir);

  const stats = {
    components: 0,
    utilities: 0,
  };

  // Process UI components
  const uiDir = join(frameworkDir, "ui");
  if (existsSync(uiDir)) {
    stats.components = await processDirectory(
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
    stats.utilities = await processDirectory(
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
    const hooks = await processDirectory(
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
      console.log(chalk.yellow(`  Expected: ${registryDir}`));
      process.exit(1);
    }

    // Ensure output directory exists
    ensureDirectory(outputDir);

    // Get all framework directories
    const allEntries = readdirSync(registryDir);
    const frameworks = allEntries.filter((dir) => {
      if (IGNORED_DIRS.includes(dir)) {
        return false;
      }

      const fullPath = join(registryDir, dir);
      const stat = statSync(fullPath);
      
      return (
        stat.isDirectory() &&
        (existsSync(join(fullPath, "ui")) ||
          existsSync(join(fullPath, "lib")) ||
          existsSync(join(fullPath, "hooks")))
      );
    });

    if (frameworks.length === 0) {
      spinner.fail(chalk.red("No valid framework directories found"));
      console.log(chalk.yellow("  Expected structure: registry/<framework>/ui/"));
      process.exit(1);
    }

    const stats: BuildStats = {
      components: 0,
      utilities: 0,
      frameworks: frameworks.length,
      errors: 0,
    };

    // Process each framework
    for (const framework of frameworks) {
      try {
        const frameworkStats = await processFramework(
          framework,
          registryDir,
          outputDir,
          spinner
        );

        stats.components += frameworkStats.components;
        stats.utilities += frameworkStats.utilities;
      } catch (error) {
        stats.errors++;
        logError(`Failed to process framework: ${framework}`, error as Error);
      }
    }

    // Create index file
    const indexPath = join(outputDir, "index.json");
    writeFileSync(
      indexPath,
      JSON.stringify(
        {
          frameworks,
          stats: {
            totalComponents: stats.components,
            totalUtilities: stats.utilities,
            totalFrameworks: stats.frameworks,
          },
          lastUpdated: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // Show results
    spinner.succeed(chalk.green.bold("✨ Registry built successfully!"));
    
    console.log(chalk.gray("\n  Summary:"));
    console.log(chalk.cyan(`    Components: ${stats.components}`));
    console.log(chalk.cyan(`    Utilities: ${stats.utilities}`));
    console.log(chalk.cyan(`    Frameworks: ${stats.frameworks}`));
    
    if (stats.errors > 0) {
      console.log(chalk.yellow(`    Errors: ${stats.errors}`));
    }
    
    console.log(chalk.gray(`\n  Output: ${relative(process.cwd(), outputDir)}\n`));

  } catch (error) {
    spinner.fail(chalk.red("Failed to build registry"));
    logError("Build error", error as Error);
    process.exit(1);
  }
}
