import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execa } from "execa";

describe("ClipMotion CLI - E2E Tests", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(
      tmpdir(),
      `clipmotion-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // Path to your built CLI executable
    cliPath = join(originalCwd, "build", "index.cjs");
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise((r) => setTimeout(r, 100));
    try {
      await rm(testDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } catch {
      // Ignore cleanup errors on Windows
    }
  });

  describe("clipmotion init", () => {
    it("initializes a project with default framework", async () => {
      const { stdout, stderr, exitCode } = await execa("node", [
        cliPath,
        "init",
        "--framework",
        "react",
        "--no-interactive",
      ]);

      expect(exitCode).toBe(0);

      // Verify config file was created
      const configPath = join(testDir, "clipmotion-components.json");
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(await readFile(configPath, "utf8"));
      expect(config.framework).toBe("react");
      expect(config.aliases.components).toBe("components");
      expect(config.aliases.utils).toBe("components/utils");

      // Verify directories were created
      expect(existsSync(join(testDir, "components"))).toBe(true);
      expect(existsSync(join(testDir, "components/utils"))).toBe(true);
    });

    it("initializes with Next.js framework", async () => {
      const { exitCode } = await execa("node", [
        cliPath,
        "init",
        "--framework",
        "nextjs",
        "--no-interactive",
      ]);

      expect(exitCode).toBe(0);

      const config = JSON.parse(
        await readFile(join(testDir, "clipmotion-components.json"), "utf8")
      );
      expect(config.framework).toBe("nextjs");
    });

    it("initializes with custom components directory", async () => {
      const { exitCode } = await execa("node", [
        cliPath,
        "init",
        "--framework",
        "vue",
        "--components-dir",
        "src/components",
        "--no-interactive",
      ]);

      expect(exitCode).toBe(0);

      const config = JSON.parse(
        await readFile(join(testDir, "clipmotion-components.json"), "utf8")
      );
      expect(config.aliases.components).toBe("src/components");
      expect(existsSync(join(testDir, "src/components"))).toBe(true);
    });

    it("fails when config already exists without overwrite", async () => {
      // First init
      await execa("node", [
        cliPath,
        "init",
        "--framework",
        "react",
        "--no-interactive",
      ]);

      // Second init should fail
      try {
        await execa("node", [
          cliPath,
          "init",
          "--framework",
          "vue",
          "--no-interactive",
        ]);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        expect(error.stderr || error.stdout).toContain("already exists");
      }
    });
  });

  describe("clipmotion add", () => {
    beforeEach(async () => {
      // Initialize project first
      await execa("node", [
        cliPath,
        "init",
        "--framework",
        "react",
        "--no-interactive",
      ]);
    });

    it("fails when project is not initialized", async () => {
      // Remove config
      await rm(join(testDir, "clipmotion-components.json"));

      try {
        await execa("node", [cliPath, "add", "test-component", "--silent"]);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        expect(error.stderr || error.stdout).toContain("not found");
      }
    });

    it("shows error when no component name provided", async () => {
      try {
        await execa("node", [cliPath, "add"]);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
      }
    });
  });

  describe("clipmotion create", () => {
    it("creates component files with all metadata", async () => {
      const { exitCode } = await execa("node", [
        cliPath,
        "create",
        "test-animation",
        "--framework",
        "react",
        "--video-url",
        "https://instagram.com/p/test",
        "--description",
        "Test animation description",
        "--category",
        "Image Effects",
        "--difficulty",
        "easy",
        "--author",
        "Test Author",
        "--github",
        "https://github.com/testuser",
        "--no-interactive",
      ]);

      expect(exitCode).toBe(0);

      // Verify component file
      const componentPath = join(
        testDir,
        "registry/react/ui/test-animation.tsx"
      );
      expect(existsSync(componentPath)).toBe(true);

      const componentContent = await readFile(componentPath, "utf8");
      expect(componentContent).toContain("TestAnimation");
      expect(componentContent).toContain(
        "@description Test animation description"
      );
      expect(componentContent).toContain("@author Test Author");
      expect(componentContent).toContain("@github https://github.com/testuser");

      // Verify README
      const readmePath = join(
        testDir,
        "registry/react/test-animation.README.md"
      );
      expect(existsSync(readmePath)).toBe(true);

      const readmeContent = await readFile(readmePath, "utf8");
      expect(readmeContent).toContain("# TestAnimation");
      expect(readmeContent).toContain("Test animation description");

      // Verify example
      const examplePath = join(
        testDir,
        "registry/react/examples/test-animation.tsx"
      );
      expect(existsSync(examplePath)).toBe(true);
    });

    it("fails with invalid component name", async () => {
      try {
        await execa("node", [
          cliPath,
          "create",
          "   ", // Empty after trimming
          "--framework",
          "react",
          "--video-url",
          "https://test.com",
          "--description",
          "Test",
          "--category",
          "Other",
          "--difficulty",
          "easy",
          "--author",
          "Test",
          "--no-interactive",
        ]);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        expect(error.stderr || error.stdout).toContain("Invalid");
      }
    });
  });

  describe("clipmotion registry:build", () => {
    it("builds registry from component files", async () => {
      // Create registry structure
      const reactUiDir = join(testDir, "registry/react/ui");
      const reactLibDir = join(testDir, "registry/react/lib");
      await mkdir(reactUiDir, { recursive: true });
      await mkdir(reactLibDir, { recursive: true });

      // Create component
      await writeFile(
        join(reactUiDir, "button.tsx"),
        `/**
 * @description Button component
 * @category UI Elements
 */
import React from "react";

export function Button() {
  return <button>Click</button>;
}
`,
        "utf8"
      );

      // Create utils
      await writeFile(
        join(reactLibDir, "cn.ts"),
        `/**
 * @description Class name utility
 */
export function cn(...classes: string[]) {
  return classes.join(" ");
}
`,
        "utf8"
      );

      const { exitCode, stdout, stderr } = await execa("node", [
        cliPath,
        "registry:build",
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("✨ Registry built successfully!");

      // Verify output files
      const buttonJsonPath = join(testDir, "public/r/react/button.json");
      const cnJsonPath = join(testDir, "public/r/react/cn.json");
      const indexJsonPath = join(testDir, "public/r/index.json");

      expect(existsSync(buttonJsonPath)).toBe(true);
      expect(existsSync(cnJsonPath)).toBe(true);
      expect(existsSync(indexJsonPath)).toBe(true);

      // Verify content
      const buttonJson = JSON.parse(await readFile(buttonJsonPath, "utf8"));
      expect(buttonJson.name).toBe("button");
      expect(buttonJson.type).toBe("registry:component");
      expect(buttonJson.description).toBe("Button component");

      const indexJson = JSON.parse(await readFile(indexJsonPath, "utf8"));
      expect(indexJson.frameworks).toContain("react");
      expect(indexJson.stats.totalComponents).toBe(1);
      expect(indexJson.stats.totalUtilities).toBe(1);
    });

    it("fails when registry directory doesn't exist", async () => {
      try {
        await execa("node", [cliPath, "registry:build"]);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        expect(error.stderr || error.stdout).toContain("not found");
      }
    });
  });

  describe("Full workflow", () => {
    it("complete workflow: init -> create -> build -> add", async () => {
      // Step 1: Initialize project
      const initResult = await execa("node", [
        cliPath,
        "init",
        "--framework",
        "react",
        "--no-interactive",
      ]);
      expect(initResult.exitCode).toBe(0);

      // Step 2: Create component
      const createResult = await execa("node", [
        cliPath,
        "create",
        "fade-in",
        "--framework",
        "react",
        "--video-url",
        "https://youtube.com/watch?v=test",
        "--description",
        "Fade in animation",
        "--category",
        "Text Animations",
        "--difficulty",
        "easy",
        "--author",
        "E2E Test",
        "--no-interactive",
      ]);
      expect(createResult.exitCode).toBe(0);

      // Verify component was created
      const componentPath = join(testDir, "registry/react/ui/fade-in.tsx");
      expect(existsSync(componentPath)).toBe(true);

      // Step 3: Build registry
      const buildResult = await execa("node", [cliPath, "registry:build"]);
      expect(buildResult.exitCode).toBe(0);

      // Verify registry was built
      const registryJsonPath = join(testDir, "public/r/react/fade-in.json");
      expect(existsSync(registryJsonPath)).toBe(true);

      const registryJson = JSON.parse(await readFile(registryJsonPath, "utf8"));
      expect(registryJson.name).toBe("fade-in");
      expect(registryJson.description).toBe("Fade in animation");

      // Step 4: Verify index.json
      const indexJson = JSON.parse(
        await readFile(join(testDir, "public/r/index.json"), "utf8")
      );
      expect(indexJson.animations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "fade-in",
            name: "fade-in",
            description: "Fade in animation",
            libraries: ["react"],
          }),
        ])
      );
    });

    it("handles multiple frameworks", async () => {
      // Create components for multiple frameworks
      const frameworks = ["react", "vue", "nextjs"];

      for (const framework of frameworks) {
        const dir = join(testDir, `registry/${framework}/ui`);
        await mkdir(dir, { recursive: true });

        await writeFile(
          join(dir, `${framework}-component.tsx`),
          `/**
 * @description ${framework} component
 */
export function Component() { return null; }
`,
          "utf8"
        );
      }

      const { exitCode } = await execa("node", [cliPath, "registry:build"]);
      expect(exitCode).toBe(0);

      // Verify all frameworks in index
      const indexJson = JSON.parse(
        await readFile(join(testDir, "public/r/index.json"), "utf8")
      );

      expect(indexJson.frameworks).toEqual(expect.arrayContaining(frameworks));
      expect(indexJson.stats.totalComponents).toBe(3);
    });
  });

  describe("Error handling", () => {
    it("shows helpful error for invalid command", async () => {
      try {
        await execa("node", [cliPath, "invalid-command"]);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
      }
    });

    it("shows version", async () => {
      const { stdout, exitCode } = await execa("node", [cliPath, "--version"]);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it("shows help", async () => {
      const { stdout, exitCode } = await execa("node", [cliPath, "--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("clipmotion");
      expect(stdout).toContain("init");
      expect(stdout).toContain("add");
      expect(stdout).toContain("create");
      expect(stdout).toContain("find");
      expect(stdout).toContain("registry:build");
    });
  });
});
