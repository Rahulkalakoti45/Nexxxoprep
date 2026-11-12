import { useEffect, useRef } from 'react'
import { cx } from '../../../components/ui/helpers.js'

const isCandidate = (speaker) => speaker === 'user' || speaker === 'candidate'

function Bubble({ mine, children, pending = false }) {
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          mine ? 'rounded-br-md bg-brand-500/90 text-white' : 'rounded-bl-md border border-line bg-raised text-ink',
          pending ? 'opacity-70' : '',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** The conversation so far as chat bubbles, following the newest line. */
export default function TranscriptPanel({ entries = [], partialText = '', currentSpeaker = 'idle', className }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length, partialText])

  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2" role="log" aria-live="polite" aria-label="Interview transcript">
        {entries.length === 0 && !partialText ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="text-sm text-ink-muted">Everything you and the interviewer say appears here as you speak.</p>
          </div>
        ) : null}
        {entries.map((entry, index) => (
          <Bubble key={`${entry.at}-${index}`} mine={isCandidate(entry.speaker)}>
            <span className="whitespace-pre-wrap">{entry.content}</span>
          </Bubble>
        ))}
        {partialText ? (
          <Bubble mine={isCandidate(currentSpeaker)} pending>
            <span className="whitespace-pre-wrap">{partialText}</span>
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-current align-middle" aria-hidden="true" />
          </Bubble>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  )
}
