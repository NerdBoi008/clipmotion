# ImageCrossfade (React)

A smooth, state-driven image crossfade component that transitions seamlessly between two stacked images.

---

## Demo

**Source:**
[https://www.instagram.com/moin_m.a.l.e.k/](https://www.instagram.com/moin_m.a.l.e.k/)

---

## Installation

```bash
clipmotion add image-crossfade
```

> This installs the React version of the component.

---

## Usage

```tsx
import ImageCrossfade from "@/components/image-crossfade";
import { useState } from "react";

export default function Example() {
  const [isDark, setIsDark] = useState(false);

  return (
    <div>
      <button onClick={() => setIsDark((v) => !v)}>
        Toggle
      </button>

      <ImageCrossfade
        from="/image-light.png"
        to="/image-dark.png"
        isDark={isDark}
      />
    </div>
  );
}
```

---

## Props

| Prop                    | Type                                                       | Default        | Description                           |
| ----------------------- | ---------------------------------------------------------- | -------------- | ------------------------------------- |
| `from`                  | `string`                                                   | —              | Source URL for the base image         |
| `to`                    | `string`                                                   | —              | Source URL for the toggled image      |
| `isDark`                | `boolean`                                                  | —              | Controls which image is visible       |
| `duration`              | `number`                                                   | `700`          | Crossfade duration in milliseconds    |
| `altFrom`               | `string`                                                   | `"Image From"` | Alt text for the base image           |
| `altTo`                 | `string`                                                   | `"Image To"`   | Alt text for the toggled image        |
| `objectFit`             | `"cover" \| "contain" \| "fill" \| "none" \| "scale-down"` | `"cover"`      | CSS object-fit value                  |
| `width`                 | `number \| string`                                         | `"100%"`       | Width of the image container          |
| `height`                | `number \| string`                                         | `256`          | Height of the image container         |
| `lazyLoad`              | `boolean`                                                  | `true`         | Enable lazy loading for images        |
| `className`             | `string`                                                   | —              | Custom class for the container        |
| `imageWrapperClassName` | `string`                                                   | —              | Custom class for the image wrapper    |
| `onTransitionStart`     | `() => void`                                               | —              | Callback fired when transition starts |
| `onTransitionEnd`       | `() => void`                                               | —              | Callback fired when transition ends   |

---

## Behavior

* Images are stacked using absolute positioning
* Opacity transitions are applied smoothly using CSS
* Transition callbacks are triggered only on state changes
* Optimized for smooth rendering using GPU-friendly styles

---

## Accessibility

* Uses proper `alt` attributes for both images
* Includes `aria-live="polite"` to announce visual changes
* Supports screen readers without interfering with layout

---

## Difficulty

**Easy**
Beginner-friendly and easy to integrate into existing React projects.

---

## Dependencies

This component assumes:

* **React**
* A utility `cn()` function (e.g. `clsx` + `tailwind-merge` or equivalent)

Dependencies are installed automatically when required.

---

## Styling (Optional)

For smoother visuals, you may add the following global styles:

```css
.toggle-img-container {
  display: inline-block;
  border-radius: 0.5rem;
  overflow: hidden;
}

.toggle-img-wrapper img {
  backface-visibility: hidden;
  transform: translateZ(0);
}
```

---

## Credits

✨ **Created by NerdBoi008**

* GitHub: [https://github.com/nerdboi008](https://github.com/nerdboi008)
* X (Twitter): [https://x.com/moin_malek](https://x.com/moin_malek)_

---

## Notes

* Ideal for **theme toggles**, **before/after comparisons**, and **interactive UI demos**
* Works well inside cards, grids, and feature sections
* Fully controlled via React state
