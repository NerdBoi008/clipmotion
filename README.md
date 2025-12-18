# ClipMotion

**ClipMotion** is a CLI tool that turns animation ideas from real‑world videos (Instagram reels, TikTok, YouTube, etc.) into reusable components for modern web frameworks.

You can:

- Add ready‑made animation components to your project  
- Generate a registry of components from source files  
- Find components by video URL  
- Scaffold new components for contributors using a shared structure  

***

## ✨ Features

- `clipmotion init` – initialize project config and paths  
- `clipmotion add` – add animation components to your project  
- `clipmotion find` – find components by video URL (Instagram, TikTok, YouTube, …)  
- `clipmotion create` – scaffold new components for contribution  
- `clipmotion registry:build` – build JSON registry used by the CLI  

Supports multiple frameworks:

- Next.js  
- React  
- Vue  
- Angular  

***

## 📦 Installation

```bash
# Global install (recommended for day-to-day use)
npm install -g clipmotion

# Or with pnpm
pnpm add -g clipmotion

# Or with yarn
yarn global add clipmotion
```

You can also run it via `npx` without global install:

```bash
npx clipmotion --help
```

***

## 🚀 Getting Started (User Flow)

### 1. Initialize ClipMotion in your project

```bash
clipmotion init
```

This will:

- Detect your framework (Next.js, React, Vue, Angular)  
- Create `clipmotion-components.json` with:
  - `framework`
  - `aliases.components`
  - `aliases.utils`
  - `registry.baseUrl` (points to the hosted JSON registry)

Example config:

```json
{
  "$schema": "https://clipmotion.dev/schema.json",
  "framework": "nextjs",
  "aliases": {
    "components": "components",
    "utils": "components/utils"
  },
  "registry": {
    "baseUrl": "https://raw.githubusercontent.com/nerdboi008/clipmotion/main/public/r"
  }
}
```

**Note:** Utils are placed inside the components folder by default to avoid conflicts with existing `lib/utils` files in your project.

***

### 2. Add a component

```bash
clipmotion add blur-image-toggle
```

This will:

- Fetch the component definition from the registry  
- Install any required npm dependencies  
- Write component files to your configured `components` alias  

Options:

```bash
clipmotion add blur-image-toggle --overwrite      # overwrite files if they exist
clipmotion add blur-image-toggle --debug          # verbose logs
clipmotion add blur-image-toggle --path src/ui    # custom target path
```

***

### 3. Find a component by video URL

If you saw an animation in a reel / short / TikTok and it’s in the registry:

```bash
clipmotion find https://www.instagram.com/p/DRPOaKMiItG/
```

The command will:

- Look up the URL in the registry index  
- Show details (name, difficulty, supported frameworks, tags)  
- Let you choose to:
  - Install the component  
  - View demo  
  - See implementation guide  

You can also auto‑install:

```bash
clipmotion find <video-url> --install
```

## 🔧 Handling Utils Files

ClipMotion components may depend on shared utilities like `cn()` (className merger).

**How it works:**

1. **First component with utils** → Creates `components/utils/index.ts`
2. **Second component with utils** → Merges new functions into existing file (if not duplicate)
3. **Duplicate functions** → Skipped automatically

**Example:**

```bash
clipmotion add blur-toggle
# Creates components/utils/index.ts with cn()

clipmotion add fade-in
# Merges any new utils into components/utils/index.ts
# Skips cn() if already present
```

**Manual override:**

```bash
clipmotion add component-name --overwrite
# Replaces utils file entirely (use with caution)
```

***

## 🧱 Repository Structure (For Contributors)

In this repo, source components live in `registry/` and are compiled into JSON under `public/r/` for the CLI.

```txt
registry/
├── nextjs/
│   ├── ui/           # Next.js components
│   ├── lib/          # Shared utilities (optional)
│   └── hooks/        # Hooks (optional)
├── react/
├── vue/
└── angular/

public/
└── r/
    ├── nextjs/       # Generated JSON for Next.js components
    ├── react/
    ├── vue/
    ├── angular/
    └── index.json    # Registry index used by `clipmotion find`
```

The CLI commands use:

- `registry/*` as the **source of truth**  
- `public/r/*` as the **runtime registry** for installs  

***

## 🛠 CLI Commands

### `clipmotion init`

Initialize ClipMotion in an existing project.

- Detects framework from files (`next.config.*`, `angular.json`, `vite.config.*`, `package.json`)  
- Asks for confirmation or manual choice if needed  
- Sets default component + utils paths  
- Installs framework‑specific deps (`clsx`, `tailwind-merge`, etc., where relevant)

***

### `clipmotion add`

Add one or more components from the registry:

```bash
clipmotion add <components...>
```

Supports:

- Registry dependencies (other internal components/utils)  
- npm dependencies and devDependencies  
- Overwrite checks for existing files  
- Debug logging  

***

### `clipmotion find`

Find and optionally install a component by video URL:

```bash
clipmotion find <video-url> [options]
```

- Matches normalized URLs against `public/r/index.json`  
- Shows metadata and next steps (install / demo / guide)  

***

### `clipmotion create`

Scaffold a new component **inside this repo** for contributors:

```bash
clipmotion create <component-name>
```

The command will:

- Ask for framework, video URL, description, category, difficulty  
- Create:
  - `registry/<framework>/ui/<component-name>.tsx|.vue`
  - `registry/<framework>/examples/<component-name>.tsx|.vue`
  - `registry/<framework>/<component-name>.README.md`
  - `registry/<framework>/CONTRIBUTING.md` (if missing)

This is the recommended way for contributors to start a new animation.

***

### `clipmotion registry:build`

Build the JSON registry used by `add` and `find`:

```bash
clipmotion registry:build
```

What it does:

- Scans `registry/<framework>/ui`, `lib`, `hooks`  
- Extracts:
  - Files
  - npm dependencies
  - dev dependencies
  - registry dependencies (e.g., `@/lib/utils`)  
- Emits `public/r/<framework>/*.json` with a `RegistryItem` structure  
- Generates `public/r/index.json` with:
  - List of animations  
  - Framework support  
  - Basic metadata  
  - `lastUpdated` timestamp  

***

## 🤝 Contributing

Contributions are **welcome and encouraged**.

- Read the [CONTRIBUTING.md](./CONTRIBUTING.md) for:
  - Local setup
  - Component creation flow
  - Registry build process
  - PR checklist  

- Please also review the [Code of Conduct](./CODE_OF_CONDUCT.md).

Typical flow for adding a new animation:

```bash
# 1. Create component scaffold
clipmotion create blur-image-toggle

# 2. Implement animation in registry/<framework>/ui/...
# 3. Build registry
clipmotion registry:build

# 4. Test installation in a sample project
clipmotion init
clipmotion add blur-image-toggle

# 5. Commit & open a PR
```

***

## 🧪 Development

Run the CLI locally without global install:

```bash
# From repo root
npm install
npm run build    # if applicable
node dist/cli.js --help
```

Or with a local link:

```bash
npm link
clipmotion --help
```

***

## 📄 License

This project is open‑source under the **MIT License**.  
See [LICENSE](./LICENSE) for details.

***

## 🙌 Acknowledgements

- Inspired by tools like `shadcn/ui` and other component CLIs  
- Built to help developers quickly recreate and share animations seen in the wild  

If you build something with ClipMotion, consider sharing it and linking back to the repo so others can discover it too.
