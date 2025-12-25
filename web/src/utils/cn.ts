import { clsx, type ClassValue } from 'clsx';

// Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
