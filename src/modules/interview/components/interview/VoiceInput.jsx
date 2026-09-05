import { useEffect, useMemo, useRef, useState } from 'react'

export default function VoiceInput({ onTranscript }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState('')
  const lastRef = useRef('')

  const SpeechRecognition = useMemo(() => window.SpeechRecognition || window.webkitSpeechRecognition, [])

  useEffect(() => {
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }
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
    return <p className="text-xs text-slate-400">Voice input is not supported on this browser.</p>
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          listening ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-900'
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${listening ? 'animate-pulse bg-white' : 'bg-emerald-500'}`} />
        {listening ? 'Stop Mic' : 'Start Mic'}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  )
}

