# ChromaticFlowBackground

A flowing, chromatic background that paints smooth, animated trails as the cursor moves.

---

## Demo

**Source video:**
[https://www.instagram.com/reel/DSR2twIDEsu](https://www.instagram.com/reel/DSR2twIDEsu)

---

## Installation

```bash
clipmotion add chromatic-flow-background
```

---

## Usage

```tsx
import ChromaticFlowBackground from "@/components/chromatic-flow-background";

export default function Example() {
  return (
    <div className="relative min-h-screen">
      <ChromaticFlowBackground />
      
      <div className="relative z-10 p-8">
        <h1 className="text-4xl font-bold">Content on top</h1>
      </div>
    </div>
  );
}
```

> The component is fixed-position and designed to sit behind your UI.

---

## Props

| Prop          | Type      | Default | Description                    |
| ------------- | --------- | ------- | ------------------------------ |
| `className`   | `string`  | —       | Additional CSS classes         |
| `lineWidth`   | `number`  | `250`   | Thickness of the flowing trail |
| `speed`       | `number`  | `0.12`  | Cursor follow smoothing speed  |
| `trailLength` | `number`  | `50`    | Number of points in the trail  |
| `hueSpeed`    | `number`  | `1`     | Speed of color cycling         |
| `baseHue`     | `number`  | `0`     | Base hue offset                |
| `saturation`  | `number`  | `90`    | Color saturation percentage    |
| `lightness`   | `number`  | `60`    | Color lightness percentage     |
| `opacity`     | `number`  | `0.9`   | Overall trail opacity          |
| `fadeTrail`   | `boolean` | `true`  | Enables trailing fade effect   |
| `enabled`     | `boolean` | `true`  | Enable or pause animation      |

---

## Behavior

* Tracks cursor movement and interpolates motion smoothly
* Renders thick, rounded trails using Canvas
* Colors continuously cycle using HSL for a chromatic effect
* Designed as a **non-interactive background** (`pointer-events: none`)
* Automatically scales for high-DPI displays

---

## Performance Notes

* Uses `requestAnimationFrame` for smooth animation
* Avoids React re-renders by drawing directly to Canvas
* Safe to use as a full-screen background
* Can be paused dynamically using the `enabled` prop

---

## Difficulty

**Medium**
No setup required, but best suited for visual or creative interfaces.

---

## Dependencies

* **React**
* A `cn()` utility (e.g. `clsx` + `tailwind-merge`)
* No external animation libraries required

---

## Tips

* Works best behind hero sections and landing pages
* Pair with dark or minimal UI for maximum contrast
* Reduce `lineWidth` and `trailLength` for subtle effects
* Disable on mobile if needed by controlling the `enabled` prop

---

## Credits

✨ **Created by NerdBoi008**

* GitHub: [https://github.com/NerdBoi008](https://github.com/NerdBoi008)
* X (Twitter): [https://x.com/moin_malek](https://x.com/moin_malek)_
* Website: [https://www.nerdboi.online](https://www.nerdboi.online)

---

If you want next, I can:

* add a **mobile-friendly variant**
* include a **GIF preview section**
* generate the **registry JSON**
* optimize for **reduced motion preferences**
* create **light/dark presets**

Just tell me 🚀
