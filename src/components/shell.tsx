import { useEffect, useState, type ReactNode } from 'react'
import { pathFor, VIEWS, VIEW_LABEL, type View } from '../nav.ts'

const ICONS: Record<View, ReactNode> = {
  overview: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" /></>,
  tasks: <><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" /></>,
  route: <><path d="M5 4v12a4 4 0 0 0 4 4h10M5 8h10a4 4 0 0 1 4 4M16 17l3 3-3 3" /><circle cx="5" cy="3" r="2" /><circle cx="19" cy="13" r="2" /></>,
  models: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
  settings: <><path d="M4 4v16M12 4v16M20 4v16M1 9h6M9 16h6M17 8h6" /></>,
}

export function Shell({ view, navigate, children }: {
  view: View; navigate: (path: string) => void; children: ReactNode;
}) {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 840px)').matches)
  useEffect(() => {
    const media = matchMedia('(min-width: 840px)')
    const change = () => setWide(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const navigation = <nav aria-label="Main navigation" className={wide ? 'side-nav' : 'bottom-nav'}>
    {VIEWS.map(item => <a key={item} href={pathFor(item)} aria-current={view === item ? 'page' : undefined}
      onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(pathFor(item))
      }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[item]}</svg>
      <span>{VIEW_LABEL[item]}</span>
    </a>)}
  </nav>
  return <>
    <header className="top-bar"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 4h16v16H4zM4 12h16" /></svg><span>Control Room</span></header>
    <div className="workspace">
      {wide && <aside className="sidebar">{navigation}</aside>}
      <main className="main-content"><div className="view" key={view}>{children}</div></main>
    </div>
    {!wide && navigation}
  </>
}
