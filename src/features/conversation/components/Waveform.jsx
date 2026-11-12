import { cx } from '../../../components/ui/helpers.js'

const BARS = [0.35, 0.6, 0.9, 0.55, 0.75, 0.45, 0.8, 0.5, 0.65, 0.4, 0.7, 0.5, 0.85, 0.45]

/** A small animated voice meter: violet while the interviewer talks, green while the candidate does. */
export default function Waveform({ active = false, tone = 'brand' }) {
  const color = tone === 'listening' ? 'bg-emerald-300' : 'bg-brand-300'
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden="true">
      {BARS.map((height, index) => (
        <span
          key={index}
          className={cx('w-[3px] origin-center rounded-full transition-opacity duration-300', color, active ? 'animate-wave opacity-90' : 'opacity-25')}
          style={{ height: `${Math.round(height * 100)}%`, animationDelay: `${(index % 7) * 0.09}s`, transform: active ? undefined : 'scaleY(0.25)' }}
        />
      ))}
    </div>
  )
}
