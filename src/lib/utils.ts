import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts underscored filenames to human-readable titles
 * Example: "Treatment_of_landfill_gas_with_low_methane_content_by_biocover_systems.pdf"
 * => "Treatment of landfill gas with low methane content by biocover systems"
 */
export function humanizeFilename(filename: string): string {
  if (!filename) return '';

  // Remove file extension
  const withoutExt = filename.replace(/\.(pdf|PDF)$/, '');

  // Replace underscores with spaces
  const withSpaces = withoutExt.replace(/_/g, ' ');

  // Capitalize first letter of each major word (optional, can be disabled)
  // For now, just return as-is to preserve original casing from metadata
  return withSpaces.trim();
}
