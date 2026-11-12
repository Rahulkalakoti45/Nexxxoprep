import { cx } from '../../../../components/ui/helpers.js'

const levels = [
  { id: 'Easy', hint: 'Warm-up. Core concepts.', bars: 1 },
  { id: 'Medium', hint: 'Like a real first round.', bars: 2 },
  { id: 'Hard', hint: 'Deep follow-ups, little mercy.', bars: 3 },
]

export default function DifficultySelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {levels.map((level) => {
        const active = value === level.id
        return (
          <button
            key={level.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${level.id}: ${level.hint}`}
            onClick={() => onChange(level.id)}
            className={cx(
              'rounded-2xl border p-4 text-left transition',
              active ? 'border-brand-400/70 bg-brand-500/15 shadow-glow' : 'border-line bg-inset hover:border-line-strong',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{level.id}</span>
              <span className="flex items-end gap-0.5" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={cx('w-1 rounded-full', n <= level.bars ? 'bg-brand-300' : 'bg-white/10')} style={{ height: 6 + n * 4 }} />
                ))}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{level.hint}</p>
          </button>
        )
      })}
    </div>
  )
}
