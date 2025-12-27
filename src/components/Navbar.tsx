import { Link, useLocation } from "react-router-dom"

const links = [
  { to: "/dba", label: "DBA" },
  { to: "/nba", label: "NBA" },
]

export function Navbar() {
  const location = useLocation()
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 px-4 py-3 text-slate-100 backdrop-blur lg:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="text-sm font-semibold">Hey!</div>
        <nav className="flex items-center gap-3 text-sm">
          {links.map((link) => {
            const active = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-md px-3 py-1 ${active ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-800 hover:text-white"}`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
