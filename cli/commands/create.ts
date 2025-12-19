import chalk from "chalk";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import ora from "ora";
import { text, select, confirm } from "@clack/prompts";
import type { Framework, CreateOptions, Difficulty } from "./types.js";

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

let DEBUG = false;

const COMPONENT_CATEGORIES = [
  "Image Effects",
  "Text Animations",
  "Scroll Effects",
  "Hover Effects",
  "Click Interactions",
  "Transitions",
  "Loading States",
  "3D Effects",
  "Particle Effects",
  "Other",
] as const;

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

function logDebug(...args: any[]): void {
  if (DEBUG) {
    console.log(chalk.gray("[DEBUG]"), ...args);
  }
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function validateComponentName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

/* -------------------------------------------------------------------------- */
/*                                 TEMPLATES                                  */
/* -------------------------------------------------------------------------- */

function getComponentTemplate(
  componentName: string,
  framework: Framework,
  description: string,
  category: string,
  videoUrl?: string
): string {
  const pascalName = toPascalCase(componentName);

  const templates: Record<Framework, string> = {
    nextjs: `"use client";

import React from "react";
// If you need utils like cn():
// import { cn } from "@/components/utils";

/**
 * @description ${description}
 * @category ${category}
 * ${videoUrl ? `@source ${videoUrl}` : ""}
 */

interface ${pascalName}Props {
  className?: string;
}

export function ${pascalName}({ className }: ${pascalName}Props) {
  return (
    <div className={className}>
      {/* TODO: Implement animation */}
      <p>Your animation here</p>
    </div>
  );
}
`,

    react: `import React from "react";

/**
 * @description ${description}
 * @category ${category}
 * ${videoUrl ? `@source ${videoUrl}` : ""}
 */

interface ${pascalName}Props {
  className?: string;
}

export function ${pascalName}({ className }: ${pascalName}Props) {
  return (
    <div className={className}>
      {/* TODO: Implement animation */}
      <p>Your animation here</p>
    </div>
  );
}
`,

    vue: `<script setup lang="ts">
/**
 * @description ${description}
 * @category ${category}
 * ${videoUrl ? `@source ${videoUrl}` : ""}
 */

interface Props {
  class?: string;
}

defineProps<Props>();
</script>

<template>
  <div :class="class">
    <!-- TODO: Implement animation -->
    <p>Your animation here</p>
  </div>
</template>

<style scoped>
/* Component styles */
</style>
`,

    angular: `import { Component, Input } from '@angular/core';

/**
 * @description ${description}
 * @category ${category}
 * ${videoUrl ? `@source ${videoUrl}` : ""}
 */

@Component({
  selector: 'app-${componentName}',
  template: \`
    <div [class]="className">
      <!-- TODO: Implement animation -->
      <p>Your animation here</p>
    </div>
  \`,
  styles: [\`
    /* Component styles */
  \`]
})
export class ${pascalName}Component {
  @Input() className?: string;
}
`,
  };

  return templates[framework];
}

function getReadmeTemplate(
  componentName: string,
  description: string,
  difficulty: Difficulty,
  videoUrl?: string
): string {
  return `# ${toPascalCase(componentName)}

${description}

## Demo

${videoUrl ? `**Source Video:** ${videoUrl}` : "Add demo GIF/video here"}

## Installation

\`\`\`bash
clipmotion add ${componentName}
\`\`\`

## Usage

\`\`\`tsx
import { ${toPascalCase(componentName)} } from '@/components/${componentName}';

export default function Example() {
  return <${toPascalCase(componentName)} />;
}
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| className | string | - | Additional CSS classes |

## Difficulty

${difficulty}

## Dependencies

List any additional dependencies here.

## Notes

Add any implementation notes or tips for users.
`;
}

function getExampleTemplate(
  componentName: string,
  framework: Framework
): string {
  const pascalName = toPascalCase(componentName);

  if (framework === "vue") {
    return `<script setup lang="ts">
import { ${pascalName} } from '../ui/${componentName}.vue';
</script>

<template>
  <div class="example-container">
    <h2>Example Usage</h2>
    <${pascalName} />
  </div>
</template>

<style scoped>
.example-container {
  padding: 2rem;
}
</style>
`;
  }

  return `import React from 'react';
import { ${pascalName} } from '../ui/${componentName}';

export default function ${pascalName}Example() {
  return (
    <div className="example-container">
      <h2>Example Usage</h2>
      <${pascalName} />
    </div>
  );
}
`;
}

function getContributionGuide(): string {
  return `# Contributing Your Component

Thank you for contributing to ClipMotion! 🎬

## Next Steps

1. **Implement the animation**
   - Add your animation logic to the component file
   - Use the video reference for accuracy
   - Keep it performant and accessible

2. **Add dependencies**
   - If you need external libraries (framer-motion, gsap, etc.), add them to package.json
   - Document all dependencies in README.md

3. **Test thoroughly**
   - Test on different screen sizes
   - Check browser compatibility
   - Verify accessibility

4. **Add examples**
   - Update the example file with real usage
   - Add variants if applicable

5. **Build the registry**
   \`\`\`bash
   npm run registry:build
   \`\`\`

6. **Submit PR**
   - Create a pull request with your changes
   - Link to the source video
   - Add a demo GIF if possible

## File Structure

\`\`\`
registry/<framework>/
├── ui/              # Your component goes here
├── examples/        # Usage examples
└── README.md        # Documentation
\`\`\`

## Questions?

- Check the [contribution guidelines](../../CONTRIBUTING.md)
- Open a discussion on GitHub
- Join our Discord community

Happy coding! 🚀
`;
}

/* -------------------------------------------------------------------------- */
/*                           COMPONENT CREATION                               */
/* -------------------------------------------------------------------------- */

async function promptForDetails(
  componentName: string,
  options: CreateOptions
): Promise<Required<Omit<CreateOptions, "debug">>> {
  console.log(chalk.blue("\n🎨 Component Setup\n"));

  // Framework
  const framework =
    options.framework ||
    ((await select({
      message: "Select framework:",
      options: [
        { value: "nextjs", label: "Next.js" },
        { value: "react", label: "React" },
        { value: "vue", label: "Vue 3" },
        { value: "angular", label: "Angular" },
      ],
      initialValue: "nextjs",
    })) as Framework);

  // Video URL
  const videoUrl =
    options.videoUrl ||
    ((await text({
      message: "Source video URL:",
      placeholder: "https://instagram.com/p/...",
      validate: (value) => {
        if (!value) return "Video URL is required";
        try {
          new URL(value);
          return undefined;
        } catch {
          return "Please enter a valid URL";
        }
      },
    })) as string);

  // Description
  const description =
    options.description ||
    ((await text({
      message: "Component description:",
      placeholder: "e.g., Smooth blur toggle on image click",
      validate: (value) =>
        value && value.length > 10
          ? undefined
          : "Please provide a detailed description",
    })) as string);

  // Category
  const category =
    options.category ||
    ((await select({
      message: "Component category:",
      options: COMPONENT_CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
      })),
      initialValue: "Other",
    })) as string);

  // Difficulty
  const difficulty =
    options.difficulty ||
    ((await select({
      message: "Difficulty level:",
      options: [
        { value: "easy", label: "Easy (CSS/Basic JS)" },
        { value: "medium", label: "Medium (Animation libraries)" },
        { value: "hard", label: "Hard (WebGL/3D)" },
      ],
      initialValue: "medium",
    })) as Difficulty);

  return {
    framework,
    videoUrl,
    description,
    category,
    difficulty,
  };
}

function createComponentFiles(
  componentName: string,
  details: Required<Omit<CreateOptions, "debug">>
): void {
  const { framework, videoUrl, description, category, difficulty } = details;

  const registryDir = join(process.cwd(), "registry");
  const frameworkDir = join(registryDir, framework);
  const uiDir = join(frameworkDir, "ui");
  const examplesDir = join(frameworkDir, "examples");

  // Ensure directories exist
  [registryDir, frameworkDir, uiDir, examplesDir].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logDebug("Created directory:", dir);
    }
  });

  // File extension based on framework
  const ext = framework === "vue" ? ".vue" : ".tsx";

  // Create component file
  const componentPath = join(uiDir, `${componentName}${ext}`);
  const componentContent = getComponentTemplate(
    componentName,
    framework,
    description,
    category,
    videoUrl
  );
  writeFileSync(componentPath, componentContent, "utf-8");

  // Create README
  const readmePath = join(frameworkDir, `${componentName}.README.md`);
  const readmeContent = getReadmeTemplate(
    componentName,
    description,
    difficulty,
    videoUrl
  );
  writeFileSync(readmePath, readmeContent, "utf-8");

  // Create example
  const examplePath = join(examplesDir, `${componentName}${ext}`);
  const exampleContent = getExampleTemplate(componentName, framework);
  writeFileSync(examplePath, exampleContent, "utf-8");

  // Create contribution guide (if not exists)
  const guideDir = join(frameworkDir, "CONTRIBUTING.md");
  if (!existsSync(guideDir)) {
    writeFileSync(guideDir, getContributionGuide(), "utf-8");
  }

  console.log(chalk.green("\n✓ Files created successfully!\n"));
  console.log(chalk.gray("  Component:"), chalk.cyan(componentPath));
  console.log(chalk.gray("  README:   "), chalk.cyan(readmePath));
  console.log(chalk.gray("  Example:  "), chalk.cyan(examplePath));
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMMAND                                 */
/* -------------------------------------------------------------------------- */

export async function createComponent(
  componentName: string,
  options: CreateOptions = {}
): Promise<void> {
  if (options.debug) {
    DEBUG = true;
    logDebug("Debug mode enabled");
  }

  console.log(chalk.bold.blue("\n🎬 Create New Component\n"));

  // Validate component name
  const kebabName = toKebabCase(componentName);
  if (!validateComponentName(kebabName)) {
    console.error(chalk.red("✗ Invalid component name"));
    console.log(
      chalk.gray("  Use kebab-case: e.g., blur-image-toggle, fade-in-text\n")
    );
    process.exit(1);
  }

  // Check if component already exists
  const registryDir = join(process.cwd(), "registry");
  if (existsSync(registryDir)) {
    const frameworks: Framework[] = ["nextjs", "react", "vue", "angular"];
    const existing = frameworks.some((fw) =>
      existsSync(join(registryDir, fw, "ui", `${kebabName}.tsx`))
    );

    if (existing) {
      const overwrite = await confirm({
        message: chalk.yellow(
          `Component "${kebabName}" already exists. Overwrite?`
        ),
        initialValue: false,
      });

      if (!overwrite) {
        console.log(chalk.gray("\nAborted.\n"));
        process.exit(0);
      }
    }
  }

  const spinner = ora("Setting up component...").start();

  try {
    spinner.stop();

    // Gather component details
    const details = await promptForDetails(kebabName, options);

    spinner.start("Creating component files...");

    // Create all necessary files
    createComponentFiles(kebabName, details);

    spinner.succeed(chalk.green.bold("✨ Component scaffolded!\n"));

    // Show next steps
    console.log(chalk.cyan("📝 Next Steps:\n"));
    console.log(chalk.gray("  1. Implement the animation logic"));
    console.log(
      chalk.gray("  2. Test with: ") +
        chalk.cyan(`npm run dev -- registry/${details.framework}/examples`)
    );
    console.log(
      chalk.gray("  3. Build registry: ") + chalk.cyan("npm run registry:build")
    );
    console.log(chalk.gray("  4. Create PR with your changes\n"));

    console.log(chalk.blue(`🎥 Source video: ${details.videoUrl}\n`));
  } catch (error) {
    spinner.fail(chalk.red("Failed to create component"));
    console.error(error);
    process.exit(1);
  }
}
