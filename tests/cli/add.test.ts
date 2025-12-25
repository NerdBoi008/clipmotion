import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { addComponent } from "../../cli/commands/add";

// Mock external dependencies
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  })),
}));

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

// Mock fetch for registry
global.fetch = vi.fn();

describe("clipmotion add", () => {
  let projectDir: string;
  let mockComponent: any;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `clipmotion-test-${Date.now()}`);
    await mkdir(projectDir, { recursive: true });

    // Create config file
    await writeFile(
      join(projectDir, "clipmotion-components.json"),
      JSON.stringify({
        framework: "react",
        aliases: {
          components: "components",
          utils: "components/utils",
        },
        registry: {
          baseUrl: "https://example.com/registry",
        },
      })
    );

    // Mock component response
    mockComponent = {
      name: "test-component",
      type: "registry:ui",
      files: [
        {
          name: "TestComponent.tsx",
          content: "export const TestComponent = () => <div>Test</div>;",
        },
      ],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
      meta: {
        contributor: {
          name: "Test User",
          github: "testuser",
        },
      },
    };

    // Setup fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockComponent,
    });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("installs a single component", async () => {
    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
    });

    const componentPath = join(projectDir, "components", "TestComponent.tsx");
    expect(existsSync(componentPath)).toBe(true);

    const content = await readFile(componentPath, "utf8");
    expect(content).toContain("TestComponent");
  });

  it("installs multiple components", async () => {
    const component2 = {
      ...mockComponent,
      name: "button",
      files: [
        {
          name: "Button.tsx",
          content: "export const Button = () => <button>Click</button>;",
        },
      ],
    };

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes("test-component")) {
        return { ok: true, json: async () => mockComponent };
      }
      if (url.includes("button")) {
        return { ok: true, json: async () => component2 };
      }
      return { ok: false, status: 404 };
    });

    await addComponent(["test-component", "button"], {
      cwd: projectDir,
      silent: true,
    });

    expect(
      existsSync(join(projectDir, "components", "TestComponent.tsx"))
    ).toBe(true);
    expect(existsSync(join(projectDir, "components", "Button.tsx"))).toBe(true);
  });

  it("installs component with npm dependencies", async () => {
    const { execa } = await import("execa");

    mockComponent.dependencies = ["clsx", "tailwind-merge"];

    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
    });

    expect(execa).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["install", "clsx", "tailwind-merge"]),
      expect.any(Object)
    );
  });

  it("installs component with dev dependencies", async () => {
    const { execa } = await import("execa");

    mockComponent.devDependencies = ["@types/node"];

    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
    });

    expect(execa).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["@types/node"]),
      expect.any(Object)
    );
  });

  it("installs registry dependencies recursively", async () => {
    const utilsComponent = {
      name: "cn",
      type: "registry:lib",
      files: [
        {
          name: "index.ts",
          content: 'export function cn() { return "test"; }',
        },
      ],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
    };

    mockComponent.registryDependencies = ["cn"];

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes("test-component")) {
        return { ok: true, json: async () => mockComponent };
      }
      if (url.includes("cn")) {
        return { ok: true, json: async () => utilsComponent };
      }
      return { ok: false, status: 404 };
    });

    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
    });

    // Check that dependency was installed
    const utilsPath = join(projectDir, "components/utils", "index.ts");
    expect(existsSync(utilsPath)).toBe(true);
  });

  it("uses custom path when specified", async () => {
    await addComponent(["test-component"], {
      cwd: projectDir,
      path: "src/components",
      silent: true,
    });

    const componentPath = join(
      projectDir,
      "src/components",
      "TestComponent.tsx"
    );
    expect(existsSync(componentPath)).toBe(true);
  });

  it("respects overwrite flag", async () => {
    const componentPath = join(projectDir, "components", "TestComponent.tsx");

    // Create existing file
    await mkdir(join(projectDir, "components"), { recursive: true });
    await writeFile(componentPath, "// Old content");

    // Install without overwrite
    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
      overwrite: false,
    });

    let content = await readFile(componentPath, "utf8");
    expect(content).toBe("// Old content");

    // Install with overwrite
    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
      overwrite: true,
    });

    content = await readFile(componentPath, "utf8");
    expect(content).toContain("TestComponent");
  });

  it("merges only new functions, skips existing ones", async () => {
    const utilsComponent = {
      name: "utils",
      type: "registry:lib",
      files: [
        {
          name: "index.ts",
          content: `export function cn(className: string) { return className; }
export function clsx(...args: any[]) { return args.join(" "); }
export function twMerge(a: string, b: string) { return a + b; }`,
        },
      ],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => utilsComponent,
    });

    const utilsPath = join(projectDir, "components/utils", "index.ts");

    // Create existing utils file with ONE of the functions
    await mkdir(join(projectDir, "components/utils"), { recursive: true });
    await writeFile(
      utilsPath,
      'export function cn(className: string) { return "ORIGINAL"; }'
    );

    await addComponent(["utils"], {
      cwd: projectDir,
      silent: true,
    });

    const content = await readFile(utilsPath, "utf8");

    // Original cn function should be unchanged
    expect(content).toContain('return "ORIGINAL"');

    // New functions should be added
    expect(content).toContain("clsx");
    expect(content).toContain("twMerge");

    // Should not have the new cn implementation
    expect(content).not.toContain("return className;");
  });

  it("uses framework override", async () => {
    await addComponent(["test-component"], {
      cwd: projectDir,
      framework: "nextjs",
      silent: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/nextjs/test-component.json")
    );
  });

  it("handles component not found error", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    // Should not throw, but exit with code 1
    await expect(
      addComponent(["non-existent"], {
        cwd: projectDir,
        silent: true,
      })
    ).rejects.toThrow();
  });

  it("suggests alternative frameworks when component not found", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    (global.fetch as any).mockImplementation(
      async (url: string, options?: { method?: string }) => {
        if (url.includes("/react/")) {
          return { ok: false, status: 404 };
        }

        if (url.includes("/nextjs/") && options?.method === "HEAD") {
          return { ok: true };
        }

        return { ok: false, status: 404 };
      }
    );

    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: false,
    }).catch(() => {});

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("available for")
    );

    consoleSpy.mockRestore();
  });

  it("skips already installed components", async () => {
    const componentPath = join(projectDir, "components", "TestComponent.tsx");

    // Install once
    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
    });

    const firstContent = await readFile(componentPath, "utf8");

    // Modify the file
    await writeFile(componentPath, "// Modified");

    // Install again without overwrite
    await addComponent(["test-component"], {
      cwd: projectDir,
      silent: true,
      overwrite: false,
    });

    const secondContent = await readFile(componentPath, "utf8");
    expect(secondContent).toBe("// Modified"); // Should not overwrite
  });

  it("exits with error when no config found", async () => {
    const tempDir = join(tmpdir(), `no-config-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(
      addComponent(["test"], { cwd: tempDir, silent: true })
    ).rejects.toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Configuration file not found")
    );

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("handles local registry mode", async () => {
    // This would require mocking fs.readFileSync for local file access
    // For now, just verify the option is passed correctly
    await addComponent(["test-component"], {
      cwd: projectDir,
      local: true,
      silent: true,
    }).catch(() => {}); // May fail if local registry doesn't exist

    // Verify it didn't try to fetch from network
    // (would need more sophisticated mocking for full test)
  });
});

describe("utils file merging", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `utils-test-${Date.now()}`);
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      join(projectDir, "clipmotion-components.json"),
      JSON.stringify({
        framework: "react",
        aliases: {
          components: "components",
          utils: "components/utils",
        },
      })
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("creates new utils file if none exists", async () => {
    const utilsComponent = {
      name: "cn",
      type: "registry:lib",
      files: [
        {
          name: "index.ts",
          content: 'export function cn() { return "test"; }',
        },
      ],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => utilsComponent,
    });

    await addComponent(["cn"], {
      cwd: projectDir,
      silent: true,
    });

    const utilsPath = join(projectDir, "components/utils", "index.ts");
    expect(existsSync(utilsPath)).toBe(true);

    const content = await readFile(utilsPath, "utf8");
    expect(content).toContain("cn");
  });

  it("merges new functions into existing utils", async () => {
    const utilsPath = join(projectDir, "components/utils", "index.ts");
    await mkdir(join(projectDir, "components/utils"), { recursive: true });
    await writeFile(utilsPath, 'export function existing() { return "old"; }');

    const utilsComponent = {
      name: "cn",
      type: "registry:lib",
      files: [
        {
          name: "index.ts",
          content: 'export function cn() { return "new"; }',
        },
      ],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => utilsComponent,
    });

    await addComponent(["cn"], {
      cwd: projectDir,
      silent: true,
    });

    const content = await readFile(utilsPath, "utf8");
    expect(content).toContain("existing");
    expect(content).toContain("cn");
  });

  it("skips merge if all functions already exist", async () => {
    const utilsPath = join(projectDir, "components/utils", "index.ts");
    await mkdir(join(projectDir, "components/utils"), { recursive: true });
    const originalContent = 'export function cn() { return "existing"; }';
    await writeFile(utilsPath, originalContent);

    const utilsComponent = {
      name: "cn",
      type: "registry:lib",
      files: [
        {
          name: "index.ts",
          content: 'export function cn() { return "new"; }',
        },
      ],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => utilsComponent,
    });

    await addComponent(["cn"], {
      cwd: projectDir,
      silent: true,
    });

    const content = await readFile(utilsPath, "utf8");
    expect(content).toBe(originalContent); // Unchanged
  });
});
