// Class-name helpers and theme constants shared by the UI components (kept apart from the
// components so React fast refresh keeps working).

/** Joins class names, skipping falsy ones. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

const BUTTON_VARIANTS = {
  primary: 'bg-brand-500 text-white shadow-glow hover:bg-brand-400',
  secondary: 'border border-line-strong bg-white/[0.03] text-ink hover:border-white/25 hover:bg-white/[0.07]',
  ghost: 'text-ink-soft hover:bg-white/[0.06] hover:text-ink',
}

const BUTTON_SIZES = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

export function buttonClass({ variant = 'primary', size = 'md', className } = {}) {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)
}

export const inputClass =
  'mt-1.5 block h-11 w-full rounded-xl border border-line-strong bg-inset px-3.5 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60'

/** Tone for a 0-100 score. */
export function scoreTone(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return 'neutral'
  // Matches the report levels: 70+ is Good or Strong, 50-69 is Developing.
  if (score >= 70) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
}

/** Shared Recharts styling so every chart matches the theme. */
export const chartTheme = {
  grid: 'rgba(255,255,255,0.06)',
  axis: '#5d6375',
  tick: { fill: '#8a90a2', fontSize: 12 },
  brand: '#9d8cff',
  brandSoft: '#7e69ff',
  tooltip: {
    contentStyle: {
      background: '#161923',
      border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: 12,
      color: '#f4f5fa',
      fontSize: 13,
      boxShadow: '0 12px 30px -12px rgba(0,0,0,0.8)',
    },
    labelStyle: { color: '#8a90a2', marginBottom: 4 },
    itemStyle: { color: '#f4f5fa' },
    cursor: { stroke: 'rgba(157,140,255,0.4)', strokeWidth: 1 },
  },
}
