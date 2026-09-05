import { useEffect, useMemo, useRef, useState } from 'react'

export default function VoiceInput({ onTranscript }) {
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState('')
  const lastTranscriptRef = useRef('')

  const SpeechRecognition = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition,
    [],
  )

  useEffect(() => {
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim()
      if (!transcript) return
      if (transcript === lastTranscriptRef.current) return
      lastTranscriptRef.current = transcript
      onTranscript((prev) => `${prev}${prev ? ' ' : ''}${transcript}`.trim())
    }

    recognition.onerror = () => {
      setError('Voice capture failed. Please continue with text input.')
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
  }, [SpeechRecognition, onTranscript])

  const toggleListening = () => {
    if (!recognitionRef.current || !supported) return
    setError('')
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }
    recognitionRef.current.start()
    setIsListening(true)
  }

  if (!supported) {
    return <p className="text-xs text-slate-500">Voice input is not supported on this browser.</p>
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggleListening}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
          isListening ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${isListening ? 'animate-pulse bg-white' : 'bg-emerald-300'}`} />
        {isListening ? 'Stop Mic' : 'Start Mic'}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}
