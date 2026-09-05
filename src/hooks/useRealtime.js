import { useEffect, useRef, useState } from 'react'
import { RealtimeClient } from '../lib/websocket.js'

export function useRealtime(userId, onEvent) {
  const [status, setStatus] = useState('idle')
  const clientRef = useRef(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!userId) {
      setStatus('idle')
      return undefined
    }

    const client = new RealtimeClient({
      userId,
      onStatus: setStatus,
      onEvent: (event) => onEventRef.current?.(event),
    })
    clientRef.current = client
    client.connect()

    const onVisible = () => {
      if (document.visibilityState === 'visible' && clientRef.current) {
        clientRef.current.connect()
      }
    }
    const onOnline = () => clientRef.current?.connect()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      client.disconnect()
      clientRef.current = null
    }
  }, [userId])

  return { status, client: clientRef.current }
}
