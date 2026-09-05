const companies = ['Amazon', 'Google', 'Microsoft', 'TCS', 'Infosys', 'Wipro']

export default function CompanySelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {companies.map((company) => (
        <button
          key={company}
          type="button"
          onClick={() => onChange(company)}
          className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
            value === company
              ? 'border-slate-200 bg-slate-100 text-slate-900'
              : 'border-white/10 bg-black/20 text-slate-200 hover:bg-white/5'
          }`}
        >
          {company}
        </button>
      ))}
    </div>
  )
}

