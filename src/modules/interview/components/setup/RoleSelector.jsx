const roles = ['SDE', 'Frontend Developer', 'Backend Developer', 'Data Analyst', 'Product Manager', 'HR']

export default function RoleSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {roles.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
            value === role ? 'border-slate-200 bg-slate-100 text-slate-900' : 'border-white/10 bg-black/20 text-slate-200 hover:bg-white/5'
          }`}
        >
          {role}
        </button>
      ))}
    </div>
  )
}

