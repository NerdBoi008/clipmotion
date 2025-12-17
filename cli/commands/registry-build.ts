import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";
import chalk from "chalk";
import ora from "ora";

interface RegistryItem {
  name: string;
  type: string;
  description?: string;
  files: Array<{
    name: string;
    content: string;
  }>;
  dependencies: string[];
  registryDependencies: string[];
}

export async function buildRegistry() {
  const spinner = ora("Building registry...").start();

  try {
    const registryDir = join(process.cwd(), "registry");
    const outputDir = join(process.cwd(), "public/r");

    // Get all framework directories
    const frameworks = readdirSync(registryDir).filter((dir) => {
      const fullPath = join(registryDir, dir);
      return existsSync(join(fullPath, "ui"));
    });

    let totalProcessed = 0;

    for (const framework of frameworks) {
      const componentsDir = join(registryDir, framework, "ui");
      const frameworkOutputDir = join(outputDir, framework);

      // Create framework output directory
      if (!existsSync(frameworkOutputDir)) {
        mkdirSync(frameworkOutputDir, { recursive: true });
      }

      // Get all component files
      const files = readdirSync(componentsDir).filter(
        (file) =>
          extname(file) === ".tsx" ||
          extname(file) === ".ts" ||
          extname(file) === ".vue"
      );

      const libDir = join(registryDir, framework, "lib");
      if (existsSync(libDir)) {
        totalProcessed += await processDirectory(
          libDir,
          frameworkOutputDir,
          framework,
          "registry:lib"
        );
      }

      for (const file of files) {
        const componentName = basename(file, extname(file));
        const filePath = join(componentsDir, file);
        const fileContent = readFileSync(filePath, "utf-8");

        const registryItem: RegistryItem = {
          name: componentName,
          type: "registry:component",
          description: `${componentName} component for ${framework}`,
          files: [
            {
              name: file,
              content: fileContent,
            },
          ],
          dependencies: extractDependencies(fileContent, framework),
          registryDependencies: [],
        };

        const outputPath = join(frameworkOutputDir, `${componentName}.json`);
        writeFileSync(outputPath, JSON.stringify(registryItem, null, 2));

        totalProcessed++;
      }
    }

    spinner.succeed(
      chalk.green(`✓ Built ${totalProcessed} component(s) for ${frameworks.length} framework(s)!`)
    );
  } catch (error) {
    if (error instanceof Error) {
        spinner.fail(chalk.red("Failed to build registry"));
        console.error(chalk.red(error.message));
        process.exit(1);
    }
  }
}

async function processDirectory(
  dir: string,
  outputDir: string,
  framework: string,
  type: string
): Promise<number> {
  const files = readdirSync(dir).filter(
    (file) =>
      extname(file) === ".tsx" ||
      extname(file) === ".ts" ||
      extname(file) === ".vue"
  );

  for (const file of files) {
    const componentName = basename(file, extname(file));
    const filePath = join(dir, file);
    const fileContent = readFileSync(filePath, "utf-8");

    const registryItem: RegistryItem = {
      name: componentName,
      type: type,
      description: `${componentName} for ${framework}`,
      files: [
        {
          name: file,
          content: fileContent,
        },
      ],
      dependencies: extractDependencies(fileContent, framework),
      registryDependencies: extractRegistryDependencies(fileContent),
    };

    const outputPath = join(outputDir, `${componentName}.json`);
    writeFileSync(outputPath, JSON.stringify(registryItem, null, 2));
  }

  return files.length;
}

function extractRegistryDependencies(content: string): string[] {
  const deps = new Set<string>();

  // Check for @/lib/utils import
  if (content.includes('from "@/lib/utils"')) {
    deps.add("utils");
  }

  return Array.from(deps);
}

function extractDependencies(content: string, framework: string): string[] {
  const dependencies = new Set<string>();
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

  // Add framework-specific base dependencies
  if (framework === 'nextjs') {
    dependencies.add('next');
  } else if (framework === 'react') {
    dependencies.add('react');
  } else if (framework === 'vue') {
    dependencies.add('vue');
  } else if (framework === 'angular') {
    dependencies.add('@angular/core');
  }

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath?.startsWith(".") && !importPath?.startsWith("@/")) {
      const packageName = importPath?.startsWith("@")
        ? importPath.split("/").slice(0, 2).join("/")
        : importPath?.split("/")[0];

        if (packageName) {
            dependencies.add(packageName);
        }
    }
  }

  return Array.from(dependencies);
}
