import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createComponent } from "../../cli/commands/create";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

// Mock ora
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

let consoleLogSpy: any;
let consoleErrorSpy: any;
let processExitSpy: any;

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  processExitSpy = vi.spyOn(process, "exit").mockImplementation((code?) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clipmotion create", () => {
  let projectDir: string;
  let originalCwd: string;
  // let consoleLogSpy: any;
  // let consoleErrorSpy: any;
  // let processExitSpy: any;

  beforeEach(async () => {
    // Save original directory
    originalCwd = process.cwd();

    projectDir = join(
      tmpdir(),
      `clipmotion-create-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(projectDir, { recursive: true });

    // Change to test directory
    process.chdir(projectDir);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?) => {
        throw new Error(`process.exit(${code})`);
      });
  });

  afterEach(async () => {
    // Restore original directory BEFORE cleanup
    process.chdir(originalCwd);

    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    processExitSpy?.mockRestore();
    vi.clearAllMocks();

    // Add delay for Windows to release file locks
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clean up temp directory
    try {
      await rm(projectDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } catch (error) {
      console.warn(`Failed to cleanup ${projectDir}:`, error);
    }
  });

  it("creates component files with all options provided", async () => {
    await createComponent("blur-image-toggle", {
      framework: "nextjs",
      videoUrl: "https://instagram.com/p/test",
      description: "Smooth blur toggle animation",
      category: "Image Effects",
      difficulty: "medium",
      author: "Test User",
      github: "https://github.com/testuser",
      x: "https://x.com/testuser",
      website: "https://testuser.dev",
    });

    // Check component file
    const componentPath = join(
      projectDir,
      "registry/nextjs/ui/blur-image-toggle.tsx"
    );
    expect(existsSync(componentPath)).toBe(true);

    const componentContent = await readFile(componentPath, "utf8");
    expect(componentContent).toContain("BlurImageToggle");
    expect(componentContent).toContain(
      "@description Smooth blur toggle animation"
    );
    expect(componentContent).toContain("@category Image Effects");
    expect(componentContent).toContain("@source https://instagram.com/p/test");
    expect(componentContent).toContain("@author Test User");
    expect(componentContent).toContain("@github https://github.com/testuser");
    expect(componentContent).toContain("@x https://x.com/testuser");
    expect(componentContent).toContain("@website https://testuser.dev");
  });

  it("creates README file with correct content", async () => {
    await createComponent("fade-in-text", {
      framework: "react",
      videoUrl: "https://youtube.com/watch?v=test",
      description: "Text fades in smoothly",
      category: "Text Animations",
      difficulty: "easy",
      author: "Creator",
    });

    const readmePath = join(
      projectDir,
      "registry/react/fade-in-text.README.md"
    );
    expect(existsSync(readmePath)).toBe(true);

    const readmeContent = await readFile(readmePath, "utf8");
    expect(readmeContent).toContain("# FadeInText");
    expect(readmeContent).toContain("Text fades in smoothly");
    expect(readmeContent).toContain(
      "**Source Video:** https://youtube.com/watch?v=test"
    );
    expect(readmeContent).toContain("clipmotion add fade-in-text");
    expect(readmeContent).toContain("## Difficulty");
    expect(readmeContent).toContain("easy");
  });

  it("creates example file", async () => {
    await createComponent("scroll-reveal", {
      framework: "nextjs",
      videoUrl: "https://example.com/video",
      description: "Reveal on scroll",
      category: "Scroll Effects",
      difficulty: "medium",
      author: "Dev",
    });

    const examplePath = join(
      projectDir,
      "registry/nextjs/examples/scroll-reveal.tsx"
    );
    expect(existsSync(examplePath)).toBe(true);

    const exampleContent = await readFile(examplePath, "utf8");
    expect(exampleContent).toContain("ScrollReveal");
    expect(exampleContent).toContain("Example Usage");
  });

  it("converts component name to kebab-case", async () => {
    await createComponent("Blur Image Toggle", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "Test component",
      category: "Other",
      difficulty: "easy",
      author: "Test",
    });

    const componentPath = join(
      projectDir,
      "registry/react/ui/blur-image-toggle.tsx"
    );
    expect(existsSync(componentPath)).toBe(true);
  });

  it("creates Vue component with .vue extension", async () => {
    await createComponent("hover-card", {
      framework: "vue",
      videoUrl: "https://example.com/test",
      description: "Hover card effect",
      category: "Hover Effects",
      difficulty: "easy",
      author: "Vue Dev",
    });

    const componentPath = join(projectDir, "registry/vue/ui/hover-card.vue");
    expect(existsSync(componentPath)).toBe(true);

    const content = await readFile(componentPath, "utf8");
    expect(content).toContain("<script setup");
    expect(content).toContain("<template>");
    expect(content).toContain("<style scoped>");
  });

  it("creates Angular component with correct template", async () => {
    await createComponent("loading-spinner", {
      framework: "angular",
      videoUrl: "https://example.com/test",
      description: "Loading animation",
      category: "Loading States",
      difficulty: "easy",
      author: "Angular Dev",
    });

    const componentPath = join(
      projectDir,
      "registry/angular/ui/loading-spinner.tsx"
    );
    expect(existsSync(componentPath)).toBe(true);

    const content = await readFile(componentPath, "utf8");
    expect(content).toContain("@Component");
    expect(content).toContain("selector: 'app-loading-spinner'");
  });

  it("creates all necessary directories", async () => {
    await createComponent("test-component", {
      framework: "nextjs",
      videoUrl: "https://example.com/test",
      description: "Test",
      category: "Other",
      difficulty: "easy",
      author: "Test",
    });

    expect(existsSync(join(projectDir, "registry"))).toBe(true);
    expect(existsSync(join(projectDir, "registry/nextjs"))).toBe(true);
    expect(existsSync(join(projectDir, "registry/nextjs/ui"))).toBe(true);
    expect(existsSync(join(projectDir, "registry/nextjs/examples"))).toBe(true);
  });

  it("creates CONTRIBUTING.md if it doesn't exist", async () => {
    await createComponent("new-component", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "Test component",
      category: "Other",
      difficulty: "easy",
      author: "Contributor",
    });

    const contributingPath = join(projectDir, "registry/react/CONTRIBUTING.md");
    expect(existsSync(contributingPath)).toBe(true);

    const content = await readFile(contributingPath, "utf8");
    expect(content).toContain("Contributing Your Component");
    expect(content).toContain("Next Steps");
  });

  it("does not overwrite CONTRIBUTING.md if it exists", async () => {
    const contributingPath = join(
      projectDir,
      "registry/nextjs/CONTRIBUTING.md"
    );
    await mkdir(join(projectDir, "registry/nextjs"), { recursive: true });
    const customContent = "# Custom Contributing Guide";
    await writeFile(contributingPath, customContent);

    await createComponent("test", {
      framework: "nextjs",
      videoUrl: "https://example.com/test",
      description: "Test",
      category: "Other",
      difficulty: "easy",
      author: "Test",
    });

    const content = await readFile(contributingPath, "utf8");
    expect(content).toBe(customContent);
  });

  it("includes optional fields only when provided", async () => {
    await createComponent("simple-component", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "Simple component without optional fields",
      category: "Other",
      difficulty: "easy",
      author: "Simple Dev",
      // No github, x, or website
    });

    const componentPath = join(
      projectDir,
      "registry/react/ui/simple-component.tsx"
    );
    const content = await readFile(componentPath, "utf8");

    expect(content).toContain("@author Simple Dev");
    expect(content).not.toContain("@github");
    expect(content).not.toContain("@x");
    expect(content).not.toContain("@website");
  });

  it("validates component name format", async () => {
    let errorThrown = false;

    try {
      await createComponent("!!!", {
        framework: "react",
        videoUrl: "https://example.com/test",
        description: "Test",
        category: "Other",
        difficulty: "easy",
        author: "Test",
      });
    } catch (error: any) {
      errorThrown = true;
      expect(error.message).toContain("process.exit(1)");
    }

    expect(errorThrown).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid component name")
    );
  });

  it("prompts for confirmation when component exists", async () => {
    const { confirm } = await import("@clack/prompts");

    // Create component first
    await createComponent("existing-component", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "First version",
      category: "Other",
      difficulty: "easy",
      author: "First",
    });

    // Mock user declining overwrite
    (confirm as any).mockResolvedValue(false);

    // Try to create again
    try {
      await createComponent("existing-component", {
        framework: "react",
        videoUrl: "https://example.com/new",
        description: "Second version",
        category: "Other",
        difficulty: "easy",
        author: "Second",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.message).toContain("process.exit(0)");
    }

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("already exists"),
      })
    );
  });

  it("overwrites when user confirms", async () => {
    const { confirm } = await import("@clack/prompts");

    // Create component first
    await createComponent("overwrite-test", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "First version",
      category: "Other",
      difficulty: "easy",
      author: "First",
    });

    // Mock user accepting overwrite
    (confirm as any).mockResolvedValue(true);

    // Create again
    await createComponent("overwrite-test", {
      framework: "react",
      videoUrl: "https://example.com/new",
      description: "Second version",
      category: "Other",
      difficulty: "medium",
      author: "Second",
    });

    const componentPath = join(
      projectDir,
      "registry/react/ui/overwrite-test.tsx"
    );
    const content = await readFile(componentPath, "utf8");

    expect(content).toContain("Second version");
    expect(content).not.toContain("First version");
  });

  it("handles all difficulty levels", async () => {
    const difficulties: Array<"easy" | "medium" | "hard"> = [
      "easy",
      "medium",
      "hard",
    ];

    for (const difficulty of difficulties) {
      await createComponent(`test-${difficulty}`, {
        framework: "react",
        videoUrl: "https://example.com/test",
        description: `Test ${difficulty}`,
        category: "Other",
        difficulty,
        author: "Test",
      });

      const readmePath = join(
        projectDir,
        `registry/react/test-${difficulty}.README.md`
      );
      const content = await readFile(readmePath, "utf8");
      expect(content).toContain(difficulty);
    }
  });

  it("handles all component categories", async () => {
    const categories = [
      "Image Effects",
      "Text Animations",
      "Scroll Effects",
      "Hover Effects",
    ];

    for (const category of categories) {
      const name = `test-${category.toLowerCase().replace(/\s+/g, "-")}`;
      await createComponent(name, {
        framework: "react",
        videoUrl: "https://example.com/test",
        description: `Test ${category}`,
        category,
        difficulty: "easy",
        author: "Test",
      });

      const componentPath = join(projectDir, `registry/react/ui/${name}.tsx`);
      const content = await readFile(componentPath, "utf8");
      expect(content).toContain(`@category ${category}`);
    }
  });

  it("uses debug mode when enabled", async () => {
    await createComponent("debug-test", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "Debug test",
      category: "Other",
      difficulty: "easy",
      author: "Test",
      debug: true,
    });

    // Debug logs should be called
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});

describe("component templates", () => {
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectDir = join(
      tmpdir(),
      `template-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      await rm(projectDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } catch (error) {
      console.warn(`Failed to cleanup ${projectDir}`);
    }
  });

  it("Next.js template includes 'use client' directive", async () => {
    await createComponent("nextjs-component", {
      framework: "nextjs",
      videoUrl: "https://example.com/test",
      description: "Test",
      category: "Other",
      difficulty: "easy",
      author: "Test",
    });

    const content = await readFile(
      join(projectDir, "registry/nextjs/ui/nextjs-component.tsx"),
      "utf8"
    );
    expect(content).toContain('"use client"');
  });

  it("React template does not include 'use client'", async () => {
    await createComponent("react-component", {
      framework: "react",
      videoUrl: "https://example.com/test",
      description: "Test",
      category: "Other",
      difficulty: "easy",
      author: "Test",
    });

    const content = await readFile(
      join(projectDir, "registry/react/ui/react-component.tsx"),
      "utf8"
    );
    expect(content).not.toContain('"use client"');
  });

  it("includes proper TypeScript interfaces", async () => {
    await createComponent("typed-component", {
      framework: "nextjs",
      videoUrl: "https://example.com/test",
      description: "Test",
      category: "Other",
      difficulty: "easy",
      author: "Test",
    });

    const content = await readFile(
      join(projectDir, "registry/nextjs/ui/typed-component.tsx"),
      "utf8"
    );
    expect(content).toContain("interface TypedComponentProps");
    expect(content).toContain("className?: string");
  });
});
