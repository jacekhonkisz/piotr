/**
 * Contrast utility functions for ensuring proper text visibility
 */

// Color luminance calculation
function getLuminance(hex: string): number {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Apply gamma correction
  const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Determine if a background is light or dark
export function isLightBackground(backgroundColor: string): boolean {
  // Handle common CSS color names and Tailwind classes
  const colorMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#000000',
    'bg-white': '#ffffff',
    'bg-gray-50': '#f9fafb',
    'bg-gray-100': '#f3f4f6',
    'bg-gray-200': '#e5e7eb',
    'bg-gray-300': '#d1d5db',
    'bg-gray-400': '#9ca3af',
    'bg-gray-500': '#6b7280',
    'bg-gray-600': '#4b5563',
    'bg-gray-700': '#374151',
    'bg-gray-800': '#1f2937',
    'bg-gray-900': '#111827',
    'bg-slate-50': '#f8fafc',
    'bg-slate-100': '#f1f5f9',
    'bg-slate-200': '#e2e8f0',
    'bg-slate-300': '#cbd5e1',
    'bg-blue-50': '#eff6ff',
    'bg-blue-100': '#dbeafe',
    'bg-blue-600': '#2563eb',
    'bg-indigo-600': '#4f46e5',
  };

  const hexColor = colorMap[backgroundColor] || backgroundColor;
  
  // If it's not a hex color, assume it's light for safety
  if (!hexColor.startsWith('#')) {
    return true;
  }
  
  const luminance = getLuminance(hexColor);
  return luminance > 0.5;
}

// Get appropriate text color for a background
export function getContrastingTextColor(backgroundColor: string): string {
  return isLightBackground(backgroundColor) ? 'text-gray-900' : 'text-white';
}

// Get appropriate muted text color for a background
export function getContrastingMutedTextColor(backgroundColor: string): string {
  return isLightBackground(backgroundColor) ? 'text-gray-600' : 'text-gray-300';
}

// Get CSS custom property for contrast
export function getContrastCSSVar(backgroundColor: string, muted: boolean = false): string {
  const isLight = isLightBackground(backgroundColor);
  if (muted) {
    return isLight ? 'var(--text-muted-on-light)' : 'var(--text-muted-on-dark)';
  }
  return isLight ? 'var(--text-on-light)' : 'var(--text-on-dark)';
}

// Validate contrast ratio meets WCAG standards
export function validateContrast(textColor: string, backgroundColor: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(textColor, backgroundColor);
  const minRatio = level === 'AAA' ? 7 : 4.5;
  return ratio >= minRatio;
}

// Get auto-contrast class name
export function getAutoContrastClass(backgroundColor: string, muted: boolean = false): string {
  const isLight = isLightBackground(backgroundColor);
  if (muted) {
    return isLight ? 'text-contrast-muted-light' : 'text-contrast-muted-dark';
  }
  return isLight ? 'text-contrast-light' : 'text-contrast-dark';
}

// Predefined safe color combinations
export const safeColorCombinations = {
  // Light backgrounds
  light: {
    primary: 'text-gray-900',
    secondary: 'text-gray-600',
    muted: 'text-gray-500',
    accent: 'text-blue-600',
    success: 'text-green-700',
    warning: 'text-amber-700',
    error: 'text-red-700',
  },
  // Dark backgrounds
  dark: {
    primary: 'text-white',
    secondary: 'text-gray-300',
    muted: 'text-gray-400',
    accent: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  },
};

// Get safe text color for specific use cases
export function getSafeTextColor(
  backgroundColor: string,
  type: keyof typeof safeColorCombinations.light = 'primary'
): string {
  const isLight = isLightBackground(backgroundColor);
  return isLight ? safeColorCombinations.light[type] : safeColorCombinations.dark[type];
} 