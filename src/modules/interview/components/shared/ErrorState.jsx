import { Button } from '../../../../components/ui/index.jsx'

export default function ErrorState({ title = 'Something went wrong', message = 'Please retry.', onRetry }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-rose-400/20 bg-surface p-10 text-center shadow-card">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-400/15 text-xl text-rose-300" aria-hidden="true">
        !
      </span>
      <h2 className="mt-5 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </section>
  )
}
