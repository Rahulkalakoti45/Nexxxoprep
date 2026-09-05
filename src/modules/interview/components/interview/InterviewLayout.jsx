export default function InterviewLayout({ left, right }) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[1.7fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6 shadow-lg shadow-black/25">{left}</section>
      <aside className="rounded-2xl border border-white/10 bg-black/20 p-4">{right}</aside>
    </div>
  )
}

