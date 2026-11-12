export default function InterviewLayout({ left, right }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">{left}</section>
      <aside className="lg:sticky lg:top-24 lg:self-start">{right}</aside>
    </div>
  )
}
