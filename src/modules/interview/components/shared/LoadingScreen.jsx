import { Spinner } from '../../../../components/ui/index.jsx'

export default function LoadingScreen({ title = 'Loading…', subtitle = 'Preparing interview session.' }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-line bg-surface p-10 text-center shadow-card">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/15 text-brand-300">
        <Spinner className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
    </section>
  )
}
