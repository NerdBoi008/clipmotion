// tests/cli/registry-build.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, relative } from "path";
import { tmpdir } from "os";
import { __test__, buildRegistry } from "../../cli/commands/registry-build";

// Mock ora
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  })),
}));

describe("registry:build", () => {
  let projectDir: string;
  let originalCwd: string;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectDir = join(
      tmpdir(),
      `clipmotion-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      // @ts-expect-error - mock exit to throw
      .mockImplementation((code?: number) => {
        throw new Error(`process.exit(${code})`);
      });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();

    await new Promise((r) => setTimeout(r, 50));
    try {
      await rm(projectDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 50,
      });
    } catch {
      // ignore on Windows
    }
  });

  it("fails when registry directory does not exist", async () => {
    await expect(buildRegistry()).rejects.toThrow("process.exit(1)");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Registry directory not found")
    );
  });

  it("fails when no valid framework directories are found", async () => {
    const registryDir = join(projectDir, "registry");
    await mkdir(registryDir, { recursive: true });

    // create some ignored dirs
    await mkdir(join(registryDir, "node_modules"), { recursive: true });

    await expect(buildRegistry()).rejects.toThrow("process.exit(1)");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No valid framework directories found")
    );
  });

  it("builds registry JSON files for a simple React component and utils", async () => {
    const registryDir = join(projectDir, "registry");
    const reactUiDir = join(registryDir, "react", "ui");
    const reactLibDir = join(registryDir, "react", "lib");

    await mkdir(reactUiDir, { recursive: true });
    await mkdir(reactLibDir, { recursive: true });

    // Component file with metadata and imports
    await writeFile(
      join(reactUiDir, "blur-image-toggle.tsx"),
      `
/**
 * @description Blur toggle component
 * @category Image Effects
 * @source https://instagram.com/p/test123
 * @author Test User
 * @github https://github.com/test
 */

import React from "react";
import { cn } from "../lib/utils";

export function BlurImageToggle() {
  return <div>Blur</div>;
}
`,
      "utf8"
    );

    // Lib file (utils)
    await writeFile(
      join(reactLibDir, "utils.ts"),
      `
/**
 * @description Utility functions
 * @author Utils Author
 */

export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
`,
      "utf8"
    );

    await buildRegistry();

    const outputDir = join(projectDir, "public", "r");
    const reactOutDir = join(outputDir, "react");
    const componentJsonPath = join(reactOutDir, "blur-image-toggle.json");
    const utilsJsonPath = join(reactOutDir, "utils.json");
    const indexJsonPath = join(outputDir, "index.json");

    // Files exist
    expect(existsSync(componentJsonPath)).toBe(true);
    expect(existsSync(utilsJsonPath)).toBe(true);
    expect(existsSync(indexJsonPath)).toBe(true);

    const componentJson = JSON.parse(await readFile(componentJsonPath, "utf8"));
    const utilsJson = JSON.parse(await readFile(utilsJsonPath, "utf8"));
    const indexJson = JSON.parse(await readFile(indexJsonPath, "utf8"));

    // Component registry item
    expect(componentJson.name).toBe("blur-image-toggle");
    expect(componentJson.type).toBe("registry:component");
    expect(componentJson.description).toBe("Blur toggle component");
    expect(componentJson.files[0].name).toBe("blur-image-toggle.tsx");
    expect(componentJson.dependencies).toContain("react");
    expect(componentJson.registryDependencies).toContain("utils");
    expect(componentJson.meta.source).toBe(
      relative(projectDir, join(reactUiDir, "blur-image-toggle.tsx"))
    );
    expect(componentJson.meta.category).toBe("Image Effects");
    expect(componentJson.meta.contributor).toEqual(
      expect.objectContaining({
        name: "Test User",
        github: "https://github.com/test",
      })
    );

    // Utils registry item
    expect(utilsJson.name).toBe("utils");
    expect(utilsJson.type).toBe("registry:lib");
    expect(utilsJson.files[0].name).toBe("utils/index.ts");
    expect(utilsJson.dependencies).toContain("react");

    // Index JSON
    expect(indexJson.frameworks).toEqual(["react"]);
    expect(indexJson.stats.totalComponents).toBe(1);
    expect(indexJson.stats.totalUtilities).toBe(1);
    expect(Array.isArray(indexJson.animations)).toBe(true);
    expect(indexJson.animations.length).toBe(2); // component + utils
    expect(indexJson.animations[0]).toEqual(
      expect.objectContaining({
        id: "blur-image-toggle",
        name: "blur-image-toggle",
        description: "Blur toggle component",
        libraries: ["react"],
        sources: [componentJson.meta.source],
      })
    );
  });

  it("handles hooks directory and counts them as utilities", async () => {
    const registryDir = join(projectDir, "registry");
    const nextHooksDir = join(registryDir, "nextjs", "hooks");
    await mkdir(nextHooksDir, { recursive: true });

    await writeFile(
      join(nextHooksDir, "use-scroll.ts"),
      `
/**
 * @description Scroll hook
 */

import { useEffect, useState } from "react";

export function useScroll() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return y;
}
`,
      "utf8"
    );

    await buildRegistry();

    const outputDir = join(projectDir, "public", "r");
    const nextOutDir = join(outputDir, "nextjs");
    const hookJsonPath = join(nextOutDir, "use-scroll.json");
    const indexJsonPath = join(outputDir, "index.json");

    expect(existsSync(hookJsonPath)).toBe(true);

    const hookJson = JSON.parse(await readFile(hookJsonPath, "utf8"));
    const indexJson = JSON.parse(await readFile(indexJsonPath, "utf8"));

    expect(hookJson.name).toBe("use-scroll");
    expect(hookJson.type).toBe("registry:hook");
    expect(hookJson.files[0].name).toBe("use-scroll.ts");
    expect(indexJson.stats.totalUtilities).toBe(1);
  });

  it("logs errors but continues building when individual files fail", async () => {
    const registryDir = join(projectDir, "registry");
    const reactDir = join(registryDir, "react", "ui");
    await mkdir(reactDir, { recursive: true });

    // Create two files
    await writeFile(
      join(reactDir, "good-component.tsx"),
      "export const Good = () => <div>Good</div>;",
      "utf8"
    );

    await writeFile(
      join(reactDir, "bad-component.tsx"),
      "export const Bad = () => null;",
      "utf8"
    );

    // Mock the wrapper exported in __test__
    const statSpy = vi
      .spyOn(__test__, "safeStatSync")
      .mockImplementation((p: string) => {
        // Throw error specifically for the bad component
        if (p.includes("bad-component.tsx")) {
          throw new Error("Failed to access file");
        }
        return { isDirectory: () => false } as any;
      });

    await buildRegistry();

    const outputDir = join(projectDir, "public", "r");
    const reactOutDir = join(outputDir, "react");
    const indexJsonPath = join(outputDir, "index.json");

    expect(existsSync(indexJsonPath)).toBe(true);

    const indexJson = JSON.parse(await readFile(indexJsonPath, "utf8"));

    // Only the good component should be built
    expect(indexJson.stats.totalComponents).toBe(1);
    expect(existsSync(join(reactOutDir, "good-component.json"))).toBe(true);
    expect(existsSync(join(reactOutDir, "bad-component.json"))).toBe(false);

    // Error should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to stat bad-component.tsx"),
      expect.any(Error)
    );

    statSpy.mockRestore();
  });
});
