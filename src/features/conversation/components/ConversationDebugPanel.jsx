export default function ConversationDebugPanel({ debug }) {
  if (!import.meta.env.DEV || !debug) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 max-h-64 w-80 overflow-y-auto rounded-xl border border-yellow-500/30 bg-black/90 p-3 font-mono text-[10px] text-yellow-100 backdrop-blur">
      <p className="mb-2 font-semibold text-yellow-300">Conversation Debug</p>
      {Object.entries(debug).map(([key, value]) => (
        <p key={key} className="truncate">
          <span className="text-yellow-500">{key}:</span> {String(value ?? '—')}
        </p>
      ))}
    </div>
  )
}
