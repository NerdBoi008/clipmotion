// registry/nextjs/lib/utils.ts
/**
 * @description Utility functions for ClipMotion components
 * @category Utilities
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
