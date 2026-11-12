import { Badge } from '../../../../components/ui/index.jsx'
import { cx } from '../../../../components/ui/helpers.js'
import { IconCode, IconFile, IconMic } from '../../../../components/ui/icons.jsx'

const modes = [
  {
    id: 'ai_simulated',
    title: 'Voice interview',
    subtitle: 'Talk with an AI interviewer in real time. Follow-ups adapt to what you say.',
    icon: IconMic,
    badge: 'Recommended',
    enabled: true,
  },
  {
    id: 'coding',
    title: 'Coding round',
    subtitle: 'Solve a problem in a real editor while an AI interviewer probes your approach.',
    icon: IconCode,
    badge: 'New',
    enabled: true,
  },
  {
    id: 'standard',
    title: 'Structured rounds',
    subtitle: 'Answer question by question, by text or voice, round after round.',
    icon: IconFile,
    enabled: true,
  },
]

export default function InterviewModeSelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Interview type" className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {modes.map((mode) => {
        const active = value === mode.id
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${mode.title}: ${mode.subtitle}`}
            disabled={!mode.enabled}
            onClick={() => onChange(mode.id)}
            className={cx(
              'flex gap-4 rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
              active ? 'border-brand-400/70 bg-brand-500/15 shadow-glow' : 'border-line bg-inset hover:border-line-strong',
            )}
          >
            <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', active ? 'bg-brand-500 text-white' : 'bg-white/[0.05] text-ink-soft')}>
              <mode.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{mode.title}</span>
                {mode.badge ? <Badge tone="brand">{mode.badge}</Badge> : null}
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{mode.subtitle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
