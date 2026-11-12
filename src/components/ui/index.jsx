import { Link } from 'react-router-dom'
import { buttonClass, cx, scoreTone } from './helpers.js'


/* ------------------------------------------------------------------ brand */

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nx-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9d8cff" />
          <stop offset="1" stopColor="#5640d6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#nx-logo)" />
      <path d="M20 44V20h5l14 16V20h5v24h-5L25 28v16z" fill="#fff" />
    </svg>
  )
}

export function Logo({ to = '/dashboard', compact = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg" aria-label="NexoPrep home">
      <LogoMark />
      {compact ? null : (
        <span className="font-display text-[17px] font-semibold tracking-tight text-ink">
          Nexo<span className="text-brand-300">Prep</span>
        </span>
      )}
    </Link>
  )
}

/* ----------------------------------------------------------------- layout */

export function Card({ as: Tag = 'section', className, children, ...rest }) {
  return (
    <Tag className={cx('min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, subtitle, action, eyebrow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Eyebrow({ children, className }) {
  return <p className={cx('mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300', className)}>{children}</p>
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </header>
  )
}

/* ---------------------------------------------------------------- actions */


export function Button({ variant, size, className, type = 'button', children, ...rest }) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, className, children, ...rest }) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </Link>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ forms */


export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  )
}

/** A row of mutually exclusive pill options. */
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const id = typeof option === 'string' ? option : option.value
        const text = typeof option === 'string' ? option : option.label
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cx(
              'rounded-xl border font-medium transition',
              size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
              active
                ? 'border-brand-400/70 bg-brand-500/15 text-ink shadow-glow'
                : 'border-line bg-inset text-ink-soft hover:border-line-strong hover:text-ink',
            )}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- data */

const TONES = {
  neutral: 'border-line-strong bg-white/[0.04] text-ink-soft',
  brand: 'border-brand-400/40 bg-brand-500/15 text-brand-200',
  good: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  warn: 'border-amber-400/35 bg-amber-400/10 text-amber-200',
  bad: 'border-rose-400/35 bg-rose-400/10 text-rose-200',
  info: 'border-sky-400/35 bg-sky-400/10 text-sky-200',
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  )
}


const RING_COLORS = { good: '#34d399', warn: '#fbbf24', bad: '#fb7185', neutral: '#5d6375', brand: '#9d8cff' }

/** A circular 0-100 score with the number in the middle. */
export function ScoreRing({ score, size = 132, stroke = 10, label, tone }) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)))
  const hasScore = score !== null && score !== undefined
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = RING_COLORS[tone || (hasScore ? scoreTone(value) : 'neutral')]
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={hasScore ? c * (1 - value / 100) : c}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.2,0.7,0.2,1)', filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display font-semibold leading-none text-ink" style={{ fontSize: size * 0.27 }}>
          {hasScore ? value : '–'}
        </p>
        {label ? <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</p> : null}
      </div>
    </div>
  )
}

/** A horizontal 0-100 bar with a label and value. */
export function ScoreBar({ label, score, hint }) {
  const has = score !== null && score !== undefined
  const value = has ? Math.max(0, Math.min(100, Math.round(score))) : 0
  const tone = has ? scoreTone(value) : 'neutral'
  const fill = { good: 'bg-emerald-400', warn: 'bg-amber-400', bad: 'bg-rose-400', neutral: 'bg-white/10' }[tone]
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-ink-soft">{label}</span>
        <span className="font-mono text-ink">{has ? value : '–'}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cx('h-full rounded-full transition-[width] duration-700', fill)} style={{ width: `${value}%` }} />
      </div>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function StatTile({ label, value, hint, icon, accent = false }) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl border p-5 shadow-card',
        accent ? 'border-brand-400/30 bg-gradient-to-br from-brand-500/20 via-surface to-surface' : 'border-line bg-surface',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-inset/60 px-6 py-10 text-center">
      {icon ? <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300">{icon}</div> : null}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }) {
  return (
    <div
      className={cx('rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03),rgba(255,255,255,0.08),rgba(255,255,255,0.03))] bg-[length:200%_100%] animate-shimmer', className)}
    />
  )
}

