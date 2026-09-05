export default function LoadingScreen({ title = 'Loading…', subtitle = 'Preparing interview session.' }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111620] p-6 shadow-lg shadow-black/25">
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
      <div className="mt-4 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 w-1/3 animate-pulse rounded-full bg-slate-200/70" />
      </div>
    </section>
  )
}

