const levels = ['Easy', 'Medium', 'Hard']

export default function DifficultySelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={`rounded-xl border px-3 py-3 text-sm transition ${
            value === level
              ? 'border-slate-200 bg-slate-100 text-slate-900'
              : 'border-white/10 bg-black/20 text-slate-200 hover:bg-white/5'
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  )
}

