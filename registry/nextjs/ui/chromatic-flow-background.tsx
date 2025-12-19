"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";

/**
 * @description A flowing, chromatic background that paints dynamic trails as the cursor moves.
 * @category Hover Effects
 * @source https://www.instagram.com/reel/DSR2twIDEsu
 * @author nerdboi008
 * @github https://github.com/NerdBoi008
 * @x https://x.com/moin_malek_
 * @website https://www.nerdboi.online
 */

interface ChromaticFlowBackgroundProps {
  className?: string;
  lineWidth?: number;
  speed?: number;
  trailLength?: number;
  hueSpeed?: number;
  baseHue?: number;
  saturation?: number;
  lightness?: number;
  opacity?: number;
  fadeTrail?: boolean;
  enabled?: boolean;
}

export default function ChromaticFlowBackground({
  className,
  lineWidth = 250,
  speed = 0.12,
  trailLength = 50,
  hueSpeed = 1,
  baseHue = 0,
  saturation = 90,
  lightness = 60,
  opacity = 0.9,
  fadeTrail = true,
  enabled = true,
}: ChromaticFlowBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const trail = useRef<{ x: number; y: number }[]>([]);
  const animationId = useRef<number>(0);
  const globalHue = useRef(0); // Global hue that continuously animates

  const getContext = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      return ctx;
    }
    return null;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
  }, []);

  const drawTrail = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!enabled || trail.current.length === 0) return;

    // Continuous global hue animation
    globalHue.current = (globalHue.current + hueSpeed) % 360;

    // Fade trail effect
    if (fadeTrail) {
      ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = 10;
    ctx.shadowColor = `hsla(${globalHue.current}, ${saturation}%, ${lightness}%, ${opacity})`;

    ctx.beginPath();
    
    // Draw trail with gradient hues based on globalHue
    trail.current.forEach((point, i) => {
      const trailProgress = (i + 1) / trail.current.length;
      const hueOffset = (trailProgress * 60) % 360; // Rainbow gradient along trail
      const hue = (globalHue.current + hueOffset + baseHue) % 360;
      const alpha = fadeTrail ? trailProgress * opacity : opacity;
      
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.stroke();
    ctx.restore();
  }, [enabled, lineWidth, fadeTrail, baseHue, saturation, lightness, opacity, hueSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = getContext(canvas);
    if (!ctx) return;

    resize();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = (e.clientX - rect.left) * window.devicePixelRatio;
      mouse.current.y = (e.clientY - rect.top) * window.devicePixelRatio;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", resize);

    const animate = () => {
      if (!enabled) {
        animationId.current = requestAnimationFrame(animate);
        return;
      }

      // Update mouse position with smoothing
      const targetX = mouse.current.x;
      const targetY = mouse.current.y;
      const current = trail.current[0] || { x: targetX, y: targetY };
      
      const newX = current.x + (targetX - current.x) * speed;
      const newY = current.y + (targetY - current.y) * speed;

      // Add new trail point
      trail.current.unshift({ x: newX, y: newY });

      // Limit trail length
      if (trail.current.length > trailLength) {
        trail.current.pop();
      }

      // Clear and redraw with continuous color animation
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTrail(ctx);

      animationId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resize);
    };
  }, [resize, getContext, drawTrail, enabled, speed, trailLength]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "fixed inset-0 z-[-1] blur-2xl h-screen w-screen pointer-events-none",
        className
      )}
    />
  );
}