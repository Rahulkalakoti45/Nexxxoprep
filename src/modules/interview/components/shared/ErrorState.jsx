export default function ErrorState({ title = 'Something went wrong', message = 'Please retry.' , onRetry }) {
  return (
    <section className="rounded-2xl border border-red-200/20 bg-[#111620] p-6 shadow-lg shadow-black/25">
      <div className="inline-flex items-center gap-2 rounded-full border border-red-200/20 bg-red-500/10 px-3 py-1 text-xs text-red-200">
        Error
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:opacity-90"
        >
          Retry
        </button>
      ) : null}
    </section>
  )
}

