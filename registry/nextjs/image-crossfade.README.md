# ImageCrossfade

A smooth crossfade animation that seamlessly transitions between two stacked images based on state.

---

## Demo

**Source video:**
[https://www.instagram.com/p/DRPOaKMiItG/](https://www.instagram.com/p/DRPOaKMiItG/)

---

## Installation

```bash
clipmotion add image-crossfade
```

---

## Usage

```tsx
import ImageCrossfade from "@/components/image-crossfade";

<ImageCrossfade
  from="/lamp-off.png"
  to="/lamp-on.png"
  isDark={isLampOn}
/>
```

---

## Props

| Prop     | Type    | Required | Description                     |
| -------- | ------- | -------- | ------------------------------- |
| `from`   | string  | ✅       | Source URL of the base image    |
| `to`     | string  | ✅       | Source URL of the toggled image |
| `isDark` | boolean | ✅       | Controls which image is visible |

> When `isDark` is `true`, the `from` image is shown.
> When `false`, the component fades to the `to` image.

---

## Difficulty

**Easy**
Beginner-friendly component with no advanced setup required.

---

## Dependencies

This component assumes:

* **Next.js** (`next/image`)
* **Tailwind CSS**
* `clsx`
* `tailwind-merge`

These dependencies are installed automatically when needed.

---

## Example: Using With a Toggle

```tsx
"use client";

import ImageCrossfade from "@/components/image-crossfade";
import { Toggle } from "@/components/ui/toggle";
import { useState } from "react";
import { MoonStarIcon, SunIcon } from "lucide-react";

export default function Home() {
  const [isDark, setIsDark] = useState(false);

  const images = [
    {
      from: "/state-turn-off.png",
      to: "/state-turn-on.jpg",
    },
    {
      from: "/state-turn-off.png",
      to: "/state-turn-on.jpg",
    },
  ];

  return (
    <div className="py-8">
      <nav className="flex items-center justify-between py-4">
        <p className="text-xl font-semibold">Toggle Image Animation</p>

        <Toggle
          variant="outline"
          aria-label="Toggle theme"
          pressed={isDark}
          onPressedChange={setIsDark}
        >
          {isDark ? (
            <MoonStarIcon className="h-5 w-5" />
          ) : (
            <SunIcon className="h-5 w-5" />
          )}
        </Toggle>
      </nav>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {images.map((img, index) => (
          <ImageCrossfade
            key={index}
            from={img.from}
            to={img.to}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Notes

* Ideal for **feature toggles**, **before/after comparisons**, and **interactive UI demos**
* Works well inside grids and cards
* Designed to be lightweight and easy to customize with Tailwind classes
