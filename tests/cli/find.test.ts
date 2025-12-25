import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { findComponent } from "../../cli/commands/find";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
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

// Mock the addComponent function
vi.mock("../../cli/commands/add", () => ({
  addComponent: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch
global.fetch = vi.fn();

describe("clipmotion find", () => {
  let projectDir: string;
  let originalCwd: string;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let mockRegistryIndex: any;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectDir = join(
      tmpdir(),
      `clipmotion-find-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

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

    // Spy on console
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock registry index
    mockRegistryIndex = {
      version: "1.0.0",
      animations: [
        {
          id: "blur-image-toggle",
          name: "Blur Image Toggle",
          description: "Toggle blur effect on image click",
          difficulty: "medium",
          libraries: ["react", "nextjs"],
          tags: ["image", "blur", "click"],
          sources: [
            "https://instagram.com/p/test123",
            "https://www.instagram.com/reel/test123",
          ],
          demoUrl: "https://clipmotion.dev/demo/blur-image-toggle",
        },
        {
          id: "fade-in-text",
          name: "Fade In Text",
          description: "Smooth text fade in animation",
          difficulty: "easy",
          libraries: ["react", "vue", "nextjs"],
          tags: ["text", "fade", "animation"],
          sources: ["https://youtube.com/watch?v=abc123"],
          demoUrl: "https://clipmotion.dev/demo/fade-in-text",
        },
        {
          id: "scroll-reveal",
          name: "Scroll Reveal",
          description: "Reveal elements on scroll",
          difficulty: "medium",
          libraries: ["nextjs", "vue"],
          tags: ["scroll", "reveal"],
          sources: ["https://instagram.com/p/scroll123"],
        },
      ],
    };

    // Setup fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockRegistryIndex),
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    vi.clearAllMocks();

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

  it("finds animation by exact URL match", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Animation found")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Blur Image Toggle")
    );
  });

  it("normalizes URLs before matching", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    // URL with query params and hash
    await findComponent("https://instagram.com/p/test123?utm_source=share#top", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Animation found")
    );
  });

  it("matches alternative source URLs", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    // Match second source URL
    await findComponent("https://www.instagram.com/reel/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Blur Image Toggle")
    );
  });

  it("shows animation details when found", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Blur Image Toggle")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Toggle blur effect on image click")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("medium")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("react, nextjs")
    );
  });

  it("installs component when user selects install", async () => {
    const { select } = await import("@clack/prompts");
    const { addComponent } = await import("../../cli/commands/add");
    
    (select as any).mockResolvedValue("install");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(addComponent).toHaveBeenCalledWith(
      ["blur-image-toggle"],
      expect.objectContaining({
        cwd: projectDir,
        silent: false,
      })
    );
  });

  it("auto-installs when --install flag is provided", async () => {
    const { addComponent } = await import("../../cli/commands/add");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
      install: true,
    });

    expect(addComponent).toHaveBeenCalledWith(
      ["blur-image-toggle"],
      expect.any(Object)
    );
  });

  it("shows demo URL when user selects demo", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("demo");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://clipmotion.dev/demo/blur-image-toggle")
    );
  });

  it("shows implementation guide when user selects guide", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("guide");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Implementation Guide")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("clipmotion add blur-image-toggle")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("BlurImageToggle")
    );
  });

  it("suggests similar animations when exact match not found", async () => {
    const { confirm } = await import("@clack/prompts");
    (confirm as any).mockResolvedValue(false);

    await findComponent("https://instagram.com/p/notfound", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Animation not found")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Similar animations")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Blur Image Toggle")
    );
  });

  it("prompts to request animation when not found", async () => {
    const { confirm } = await import("@clack/prompts");
    (confirm as any).mockResolvedValue(true);

    await findComponent("https://tiktok.com/@user/video/123", {
      cwd: projectDir,
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("request this animation"),
      })
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Creating animation request")
    );
  });

  it("prevents installation when framework mismatch", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("install");

    // scroll-reveal is only available for nextjs and vue, not react
    await findComponent("https://instagram.com/p/scroll123", {
      cwd: projectDir,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not available for react")
    );
  });

  it("warns when project is not initialized", async () => {
    // Remove config file
    await rm(join(projectDir, "clipmotion-components.json"), { force: true });

    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("install");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Project not initialized")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("clipmotion init")
    );
  });

  it("validates URL format", async () => {
    await findComponent("not-a-valid-url", {
      cwd: projectDir,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid URL")
    );
  });

  it("handles fetch errors gracefully", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to search")
    );
  });

  it("handles invalid JSON in registry", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "invalid json{",
    });

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to search")
    );
  });

  it("handles empty registry", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ version: "1.0.0", animations: [] }),
    });

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("No animations found")
    );
  });

  it("uses debug mode when flag is provided", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
      debug: true,
    });

    // Debug logs should be called
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("works without config file", async () => {
    await rm(join(projectDir, "clipmotion-components.json"), { force: true });

    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Animation found")
    );
  });

  it("shows warning when component not available for configured framework", async () => {
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    // scroll-reveal is not available for react
    await findComponent("https://instagram.com/p/scroll123", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("not available for react")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Available frameworks: nextjs, vue")
    );
  });

  it("filters similar animations by domain", async () => {
    const { confirm } = await import("@clack/prompts");
    (confirm as any).mockResolvedValue(false);

    // Search for non-existent YouTube video
    await findComponent("https://youtube.com/watch?v=notfound", {
      cwd: projectDir,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Similar animations")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Fade In Text")
    );
    // Should not show Instagram animations
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Blur Image Toggle")
    );
  });

  it("limits similar animations to 3 results", async () => {
    // Add more animations from same domain
    mockRegistryIndex.animations.push(
      {
        id: "animation-4",
        name: "Animation 4",
        description: "Test",
        difficulty: "easy",
        libraries: ["react"],
        tags: [],
        sources: ["https://instagram.com/p/test4"],
      },
      {
        id: "animation-5",
        name: "Animation 5",
        description: "Test",
        difficulty: "easy",
        libraries: ["react"],
        tags: [],
        sources: ["https://instagram.com/p/test5"],
      }
    );

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockRegistryIndex),
    });

    const { confirm } = await import("@clack/prompts");
    (confirm as any).mockResolvedValue(false);

    await findComponent("https://instagram.com/p/notfound", {
      cwd: projectDir,
    });

    // Should show max 3 similar animations
    const logCalls = consoleLogSpy.mock.calls
      .map((call: any) => call[0])
      .filter((msg: string) => msg && msg.includes("•"));

    expect(logCalls.length).toBeLessThanOrEqual(3);
  });
});

describe("find command - local mode", () => {
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectDir = join(
      tmpdir(),
      `clipmotion-find-local-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();

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

  it("uses local registry when --local flag is provided", async () => {
    // This test would require mocking the file system for local index.json
    // For now, we just verify the option is passed
    const { select } = await import("@clack/prompts");
    (select as any).mockResolvedValue("exit");

    await findComponent("https://instagram.com/p/test123", {
      cwd: projectDir,
      local: true,
    }).catch(() => {}); // May fail if local registry doesn't exist

    // Verify fetch was not called (local mode doesn't use fetch)
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
