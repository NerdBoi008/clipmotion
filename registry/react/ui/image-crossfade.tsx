import React, { useRef, useEffect } from "react";
import { cn } from "../lib/utils";

export interface ToggleImgProps {
  from: string;
  to: string;
  isDark: boolean;
  duration?: number;
  altFrom?: string;
  altTo?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  className?: string;
  imageWrapperClassName?: string;
  width?: number | string;
  height?: number | string;
  lazyLoad?: boolean;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

const ToggleImg: React.FC<ToggleImgProps> = ({
  from,
  to,
  isDark,
  duration = 700,
  altFrom = "Image From",
  altTo = "Image To",
  objectFit = "cover",
  className,
  imageWrapperClassName,
  width = "100%",
  height = 256,
  lazyLoad = true,
  onTransitionStart,
  onTransitionEnd,
}) => {
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsDarkRef = useRef(isDark);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (prevIsDarkRef.current !== isDark) {
      onTransitionStart?.();
      
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      transitionTimerRef.current = setTimeout(() => {
        onTransitionEnd?.();
      }, duration);

      prevIsDarkRef.current = isDark;
    }

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [isDark, duration, onTransitionStart, onTransitionEnd]);

  const containerStyle: React.CSSProperties = {
    width,
    height,
    position: "relative",
    overflow: "hidden",
  };

  const imageStyle: React.CSSProperties = {
    objectFit,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  };

  const transitionStyle = {
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "ease-in-out",
    transitionProperty: "opacity",
  };

  return (
    <div className={cn("toggle-img-container", className)}>
      <div
        className={cn("toggle-img-wrapper", imageWrapperClassName)}
        style={containerStyle}
        aria-live="polite"
        aria-label={`Showing ${isDark ? altFrom : altTo} image`}
      >
        <img
          src={from}
          alt={altFrom}
          style={{
            ...imageStyle,
            ...transitionStyle,
            opacity: isDark ? 1 : 0,
          }}
          loading={lazyLoad ? "lazy" : "eager"}
          className="toggle-img-base"
        />

        <img
          src={to}
          alt={altTo}
          style={{
            ...imageStyle,
            ...transitionStyle,
            opacity: isDark ? 0 : 1,
          }}
          loading={lazyLoad ? "lazy" : "eager"}
          className="toggle-img-toggled"
        />
      </div>
    </div>
  );
};

export default ToggleImg;


// Add this to your global CSS for smoother animations:

// .toggle-img-container {
//   display: inline-block;
//   border-radius: 0.5rem;
//   overflow: hidden;
//   box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
// }

// .toggle-img-wrapper {
//   position: relative;
// }

// /* Optimize image rendering */
// .toggle-img-wrapper img {
//   backface-visibility: hidden;
//   -webkit-backface-visibility: hidden;
//   transform: translateZ(0);
//   -webkit-transform: translateZ(0);
// }