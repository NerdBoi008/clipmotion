# 🎬 ClipMotion Pull Request

Thank you for contributing to ClipMotion! Please fill out the details below to help us review your PR quickly and effectively.

---

## Overview

**What does this PR do?**

- [ ] Adds a new animation component
- [ ] Updates an existing component
- [ ] Changes CLI behavior (init/add/find/create/registry:build)
- [ ] Fixes a bug
- [ ] Improves docs / examples
- [ ] Other

**Short description:**

> e.g. “Add blur image toggle animation for Next.js and React”,  
> “Fix dependency resolution in add command”, etc.

---

## For Animation Components

> Skip this section if your PR is not about a component.

### 1. Component Details

- **Component name:**  
  (kebab‑case, e.g. `blur-image-toggle`)

- **Framework(s) implemented:**
  - [ ] Next.js
  - [ ] React
  - [ ] Vue
  - [ ] Angular

- **Source video link(s):**

> Instagram / TikTok / YouTube / other

- **Description of the animation:**

> What does it do, and when does it trigger (hover, scroll, click, on load, etc.)?

- **Difficulty:**
  - [ ] Easy
  - [ ] Medium
  - [ ] Hard

### 2. Files Touched (Components)

List key files you added/changed, for example:

- `registry/nextjs/ui/blur-image-toggle.tsx`
- `registry/nextjs/examples/blur-image-toggle.tsx`
- `registry/nextjs/blur-image-toggle.README.md`

---

## For CLI / Core Changes

> Skip this section if your PR only adds components.

**Which part of the CLI/core is affected?**

- [ ] `init`
- [ ] `add`
- [ ] `find`
- [ ] `create`
- [ ] `registry:build`
- [ ] Registry format / structure
- [ ] Other (specify):

**Summary of changes:**

> Describe what changed and why.

**Breaking changes?**

- [ ] No
- [ ] Yes (explain clearly below)

If **Yes**, describe what breaks and how users should migrate:

> …

---

## Checklist

Please confirm:

- [ ] My code compiles without TypeScript errors
- [ ] `clipmotion registry:build` runs successfully (if I added/changed components)
- [ ] New/updated components can be installed with `clipmotion add <name>`
- [ ] I’ve added or updated examples where appropriate
- [ ] I’ve updated or added relevant README/docs where needed
- [ ] I’ve run formatting / linting if configured

---

## Testing

**How did you test your changes?**

- [ ] Local install via `clipmotion add`
- [ ] Tested in a sample Next.js app
- [ ] Tested in a sample React app
- [ ] Tested in a sample Vue app
- [ ] Tested in a sample Angular app
- [ ] Other:

**Steps to reproduce / verify:**

```bash
# Example:
clipmotion init
clipmotion add blur-image-toggle
npm run dev
# Navigate to /page-that-uses-component
```

---

## Screenshots / Demos (Optional but Highly Recommended)

If your PR adds or changes animations, please attach:

- GIFs / videos showing the animation
- Before/after comparisons if updating existing behavior

---

## Additional Notes

Add anything else reviewers should know (design decisions, trade‑offs, follow‑up ideas, etc.):

> …
