import { describe, it, expect } from "vitest";
import { glob } from "glob";
import { readFileSync } from "fs";
import { registryItemSchema } from "../../cli/registry-schema";

describe("Registry Data Integrity", async () => {
  // Find all JSON files in the registry, excluding the main index.json
  const registryFiles = glob.sync("public/r/**/*.json").filter(
    (file) => !file.endsWith("index.json")
  );

  if (registryFiles.length === 0) {
    it.skip("No registry files found to validate", () => {});
  }

  it.each(registryFiles)("should validate schema for %s", (filePath) => {
    const rawData = readFileSync(filePath, "utf-8");
    const json = JSON.parse(rawData);
    
    const result = registryItemSchema.safeParse(json);

    if (!result.success) {
      // Format error messages for better readability in terminal
      const errors = result.error.issues.map(
        (i) => `  - [${i.path.join(".")}] ${i.message}`
      ).join("\n");
      
      throw new Error(`Invalid registry item at ${filePath}:\n${errors}`);
    }

    expect(result.success).toBe(true);
  });
});