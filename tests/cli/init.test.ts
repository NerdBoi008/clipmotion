import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { InitResult } from "../../cli/commands/types";
import { init } from "../../cli/commands/init";

describe("clipmotion init", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `clipmotion-test-${Date.now()}`);
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("creates config with specified framework", async () => {
    const config: InitResult = await init({
      cwd: projectDir,
      framework: "nextjs",
      interactive: false,
    });

    expect(config.framework).toBe("nextjs");
    expect(config.componentsDir).toBe("components");

    const configPath = join(projectDir, "clipmotion-components.json");
    expect(existsSync(configPath)).toBe(true);

    const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
    expect({
      framework: savedConfig.framework,
      componentsDir: savedConfig.aliases.components,
    }).toEqual(config);
  });

  it("creates components directory", async () => {
    await init({
      cwd: projectDir,
      framework: "react",
      interactive: false,
    });

    const componentsDirPath = join(projectDir, "components");
    expect(existsSync(componentsDirPath)).toBe(true);
  });

  it("uses custom components directory", async () => {
    const config = await init({
      cwd: projectDir,
      framework: "vue",
      componentsDir: "components",
      interactive: false,
    });

    expect(config.componentsDir).toBe("components");

    const customDirPath = join(projectDir, "components");
    expect(existsSync(customDirPath)).toBe(true);
  });

  it("auto-detects framework when not specified", async () => {
    // Create package.json with Next.js dependency
    await writeFile(
      join(projectDir, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "^14.0.0",
        },
      })
    );

    const config = await init({
      cwd: projectDir,
      interactive: false,
    });

    expect(config.framework).toBe("nextjs");
  });

  it("defaults to react when no framework detected", async () => {
    const config = await init({
      cwd: projectDir,
      interactive: false,
    });

    expect(config.framework).toBe("react");
  });

  it("throws error if config already exists in non-interactive mode", async () => {
    await init({
      cwd: projectDir,
      framework: "react",
      interactive: false,
    });

    await expect(
      init({
        cwd: projectDir,
        framework: "vue",
        interactive: false,
      })
    ).rejects.toThrow("Config file already exists");
  });
});
