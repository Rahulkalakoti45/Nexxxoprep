export default function InterviewLayout({ left, right, debug }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <section className="col-span-2">{left}</section>
      <aside>{right}</aside>
      {debug}
    </div>
  )
}
