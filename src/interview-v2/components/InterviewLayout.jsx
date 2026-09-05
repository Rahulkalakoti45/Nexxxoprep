export default function InterviewLayout({ left, right }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[1.7fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{left}</section>
      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">{right}</aside>
    </div>
  )
}
