export default function Waveform({ active = false }) {
  const bars = [0.35, 0.6, 0.9, 0.55, 0.75, 0.45, 0.8, 0.5, 0.65, 0.4]
  return (
    <div className="flex h-16 items-end justify-center gap-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      {bars.map((height, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full bg-slate-200 transition-all duration-300 ${active ? 'animate-pulse' : 'opacity-40'}`}
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  )
}
