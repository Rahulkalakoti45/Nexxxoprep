import { useEffect, useMemo, useRef, useState } from 'react'

export default function VoiceInput({ onTranscript }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const lastRef = useRef('')

  const SpeechRecognition = useMemo(() => window.SpeechRecognition || window.webkitSpeechRecognition, [])
  const supported = Boolean(SpeechRecognition)

  useEffect(() => {
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'

    rec.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim()
      if (!transcript) return
      if (transcript === lastRef.current) return
      lastRef.current = transcript
      onTranscript((prev) => `${prev}${prev ? ' ' : ''}${transcript}`.trim())
    }
    rec.onerror = () => {
      setError('Mic error. Please continue with text input.')
      setListening(false)
    }
    rec.onend = () => setListening(false)

    recognitionRef.current = rec
  }, [SpeechRecognition, onTranscript])

  const toggle = () => {
    setError('')
    if (!supported || !recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }
    recognitionRef.current.start()
    setListening(true)
  }

  if (!supported) {
    return <p className="text-xs text-ink-faint">Voice typing isn&apos;t supported in this browser. Type your answer instead.</p>
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
          listening ? 'bg-rose-500 text-white' : 'border border-line-strong bg-white/[0.04] text-ink hover:bg-white/[0.08]'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${listening ? 'animate-pulse bg-white' : 'bg-rose-400'}`} aria-hidden="true" />
        {listening ? 'Stop dictating' : 'Dictate'}
      </button>
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </div>
  )
}
