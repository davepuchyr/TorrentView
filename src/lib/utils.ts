import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytes: number) {
  if (bytes === 0) return "0 B/s";
  return formatBytes(bytes, 2) + "/s";
}

export function formatEta(seconds: number) {
  if (seconds === Infinity || !isFinite(seconds) || seconds < 0) {
    return "∞";
  }
  if (seconds < 1) {
    return "< 1s";
  }
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && d === 0) parts.push(`${m}m`);
  
  if (parts.length === 0) {
    const s = Math.floor(seconds % 60);
    if (s > 0) return `${s}s`;
    return "< 1m";
  }
  
  return parts.slice(0, 2).join(" ");
}
