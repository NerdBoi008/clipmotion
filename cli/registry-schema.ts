import { z } from "zod";

export const contributorSchema = z.object({
  name: z.string().min(1, "Contributor name is required"),
  github: z.string().url().optional().or(z.string().startsWith("https://github.com/")),
  x: z.string().optional(),
  twitter: z.string().optional(),
  website: z.string().url().optional(),
});

export const registryItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["registry:component", "registry:lib", "registry:hook"]),
  framework: z.enum(["nextjs", "react", "vue", "angular"]),
  dependencies: z.array(z.string()).default([]),
  devDependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  files: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
      type: z.string(),
    })
  ),
  meta: z.object({
    category: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    source: z.string().optional(),
    contributor: contributorSchema.optional(),
  }),
});

export type RegistryItem = z.infer<typeof registryItemSchema>;