/**
 * Chart theme palette — R.77 dark-theme overhaul.
 *
 * Recharts SVG attributes (stroke / fill) cannot read CSS variables, so we
 * resolve the active palette at render time via `useTheme()`.
 *
 * Rule of thumb:
 * - light: low-saturation slate, light grid, deeper bars
 * - dark:  higher-contrast slate, dark grid, brighter bars (because the
 *          background is already dark, the bars must lift up)
 */

export interface ChartPalette {
  /** CartesianGrid stroke */
  grid: string
  /** X / Y axis tick text fill */
  axis: string
  /** Primary series fill (first / main bar) */
  bar1: string
  /** Secondary series fill */
  bar2: string
  /** Tertiary series fill (lightest) */
  bar3: string
  /** Tooltip background */
  tooltipBg: string
  /** Tooltip border */
  tooltipBorder: string
  /** Tooltip body text */
  tooltipText: string
  /** Legend text */
  legendText: string
}

export const lightPalette: ChartPalette = {
  grid: "#e2e8f0", // slate-200
  axis: "#94a3b8", // slate-400
  bar1: "#475569", // slate-600
  bar2: "#94a3b8", // slate-400
  bar3: "#cbd5e1", // slate-300
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
  tooltipText: "#0f172a", // slate-900
  legendText: "#334155", // slate-700
}

export const darkPalette: ChartPalette = {
  grid: "#334155", // slate-700
  axis: "#94a3b8", // slate-400
  bar1: "#94a3b8", // slate-400 (lifted)
  bar2: "#cbd5e1", // slate-300
  bar3: "#e2e8f0", // slate-200 (lightest)
  tooltipBg: "#0f172a", // slate-900
  tooltipBorder: "#334155", // slate-700
  tooltipText: "#f1f5f9", // slate-100
  legendText: "#cbd5e1", // slate-300
}

export function getChartPalette(theme: "light" | "dark" | undefined | null): ChartPalette {
  return theme === "dark" ? darkPalette : lightPalette
}
