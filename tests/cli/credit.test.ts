import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { showCredits } from "../../cli/commands/credits"; // Adjust path as needed

describe("cli:credits", () => {
  let projectDir: string;
  let originalCwd: string;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectDir = join(
      tmpdir(),
      `clipmotion-credits-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    // Spy on console to verify output
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Prevent the test from actually exiting the process
    processExitSpy = vi
      .spyOn(process, "exit")
      // @ts-expect-error - mock exit to throw so we can catch it
      .mockImplementation((code?: number) => {
        throw new Error(`process.exit(${code})`);
      });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    await rm(projectDir, { recursive: true, force: true });
  });

  it("fails if the registry index is missing", async () => {
    // Calling without creating the public/r directory first
    await expect(showCredits()).rejects.toThrow("process.exit(1)");
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Registry not found")
    );
  });

  it("shows credits for a specific component", async () => {
    const registryRoot = join(projectDir, "public", "r");
    const reactDir = join(registryRoot, "react");
    await mkdir(reactDir, { recursive: true });

    // 1. Create the dummy index.json
    await writeFile(join(registryRoot, "index.json"), JSON.stringify({}));

    // 2. Create a component JSON with contributor info
    const componentData = {
      name: "pixel-card",
      description: "A cool pixel effect",
      meta: {
        contributor: {
          name: "Jane Doe",
          github: "https://github.com/janedoe",
          x: "https://x.com/janedoe"
        },
        source: "https://instagram.com/p/123"
      }
    };
    await writeFile(join(reactDir, "pixel-card.json"), JSON.stringify(componentData));

    await showCredits("pixel-card", { local: false });

    // Verify output contains contributor details
    const output = consoleLogSpy.mock.calls.map(call => call[0]).join("\n");
    expect(output).toContain("pixel-card");
    expect(output).toContain("Jane Doe");
    expect(output).toContain("https://github.com/janedoe");
    expect(output).toContain("https://instagram.com/p/123");
  });

  it("shows a summary of all contributors when no component is specified", async () => {
    const registryRoot = join(projectDir, "public", "r");
    const reactDir = join(registryRoot, "react");
    const vueDir = join(registryRoot, "vue");
    await mkdir(reactDir, { recursive: true });
    await mkdir(vueDir, { recursive: true });

    await writeFile(join(registryRoot, "index.json"), JSON.stringify({}));

    // Contributor A (2 components)
    const comp1 = { name: "comp1", meta: { contributor: { name: "Alice", github: "alice-git" } } };
    const comp2 = { name: "comp2", meta: { contributor: { name: "Alice", github: "alice-git" } } };
    
    // Contributor B (1 component)
    const comp3 = { name: "comp3", meta: { contributor: { name: "Bob" } } };

    await writeFile(join(reactDir, "comp1.json"), JSON.stringify(comp1));
    await writeFile(join(reactDir, "comp2.json"), JSON.stringify(comp2));
    await writeFile(join(vueDir, "comp3.json"), JSON.stringify(comp3));

    await showCredits(undefined, { local: false });

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join("\n");
    
    // Check contributor counts and names
    expect(output).toContain("2 contributors");
    expect(output).toContain("Alice");
    expect(output).toContain("2 components");
    expect(output).toContain("Bob");
    expect(output).toContain("1 component");
    expect(output).toContain("Thank you");
  });

  it("displays a warning if the component exists but has no contributor info", async () => {
    const registryRoot = join(projectDir, "public", "r");
    const reactDir = join(registryRoot, "react");
    await mkdir(reactDir, { recursive: true });
    await writeFile(join(registryRoot, "index.json"), JSON.stringify({}));

    // Component with no meta.contributor
    const componentData = { name: "no-credit-comp", meta: {} };
    await writeFile(join(reactDir, "no-credit-comp.json"), JSON.stringify(componentData));

    await showCredits("no-credit-comp", { local: false });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found or has no credits')
    );
  });
});