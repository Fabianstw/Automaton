type PlaceholderPageProps = {
  id?: string
  title: string
  note?: string
}

export function PlaceholderPage({ id, title, note }: PlaceholderPageProps) {
  return (
    <section id={id} className="mx-auto max-w-5xl px-4 py-12 text-slate-50 lg:px-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">Placeholder page. {note || "Content coming soon."}</p>
    </section>
  )
}
