import type { Ora } from "ora";

/* ------------------------- Shared primitives ------------------------- */

export type Framework = "nextjs" | "react" | "vue" | "angular";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export type Difficulty = "easy" | "medium" | "hard";

export type ComponentType =
  | "registry:component"
  | "registry:lib"
  | "registry:hook";

export interface ContributorInfo {
  name?: string;
  github?: string;
  x?: string; // formerly twitter
  website?: string;
}

/* ---------------------------- Core config ---------------------------- */

export interface BaseAliases {
  components: string;
  utils: string;
}

export interface BaseRegistryConfig {
  baseUrl?: string;
}

export interface TailwindConfig {
  config: string;
  css: string;
  baseColor: string;
  cssVariables: boolean;
}

export interface ComponentConfig {
  $schema?: string;
  style?: string;
  framework: Framework;
  aliases: BaseAliases;
  registry?: BaseRegistryConfig;
  tailwind?: TailwindConfig;
}

/** For init command result / file shape (stricter) */
export interface InitConfig {
  $schema: string;
  framework: Framework;
  aliases: BaseAliases;
  registry: {
    baseUrl: string;
  };
}

/* --------------------------- Registry types -------------------------- */

export interface RegistryFile {
  name: string;
  content: string;
}

export interface RegistryItem {
  name: string;
  type: ComponentType;
  description?: string;
  files: RegistryFile[];
  dependencies: string[];
  devDependencies?: string[];
  registryDependencies: string[];
  meta?: {
    source?: string;
    category?: string;
    contributor?: ContributorInfo;
  };
}

export interface BuildStats {
  components: number;
  utilities: number;
  frameworks: number;
  errors: number;
}

/* --------------------------- Add command ----------------------------- */

export interface AddOptions {
  yes?: boolean;
  debug?: boolean;
  overwrite?: boolean;
  cwd?: string;
  all?: boolean;
  path?: string;
  silent?: boolean;
  srcDir?: boolean;
  cssVariables?: boolean;
  local?: boolean;
  framework?: string;
}

export interface InstallContext {
  installed: Set<string>;
  config: ComponentConfig;
  framework: Framework;
  options: AddOptions;
  spinner: Ora | null;
}

export type MergeResult = "created" | "merged" | "skipped";

export interface RegistryComponent {
  name: string;
  type: string;
  files: RegistryFile[];
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  meta?: {
    description?: string;
    source?: string;
    contributor?: ContributorInfo;
  };
}

/* --------------------------- Create command -------------------------- */

export interface CreateOptions {
  framework?: Framework;
  videoUrl?: string;
  description?: string;
  category?: string;
  difficulty?: Difficulty;
  author?: string;
  github?: string;
  x?: string;
  website?: string;
  debug?: boolean;
}

/* ---------------------------- Find command --------------------------- */

export interface FindOptions {
  debug?: boolean;
  install?: boolean;
  overwrite?: boolean;
  cwd?: string;
  local?: boolean;
}

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  sources: string[];
  tags: string[];
  difficulty: Difficulty;
  libraries: Framework[];
  demoUrl?: string;
  dependencies?: string[];
}

export interface RegistryIndex {
  animations: RegistryEntry[];
  version: string;
  lastUpdated: string;
}

/* --------------------------- Credits command ------------------------- */

export interface CreditOptions {
  local?: boolean;
}
