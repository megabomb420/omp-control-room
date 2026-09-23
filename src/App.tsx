import { useEffect, useState } from 'react'
import { Shell } from './components/shell.tsx'
import { normalizeBase, pathFor, viewFromLocation } from './nav.ts'
import { useData } from './use-data.ts'
import { Settings } from './components/settings.tsx'
import { Route } from './components/route.tsx'
import { Tasks } from './components/tasks.tsx'
import { Overview } from './components/overview.tsx'
import { Models } from './components/models.tsx'
import './styles.css'

export default function App() {
  const [pathname, setPathname] = useState(location.pathname)
  const { data, blocked } = useData()
  const view = viewFromLocation(pathname, import.meta.env.BASE_URL)
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === normalizeBase(import.meta.env.BASE_URL)) {
      history.replaceState(null, '', pathFor('overview'))
      setPathname(location.pathname)
    }
    const pop = () => setPathname(location.pathname)
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])
  function navigate(path: string) {
    history.pushState(null, '', path)
    setPathname(location.pathname)
    window.scrollTo(0, 0)
  }
  if (blocked) return <div className="storage-error" role="alert">This browser blocked local storage.</div>
  if (!data) return <div className="storage-error" role="status">Opening local data…</div>
  const parsed = data.snapshots.find(snapshot => snapshot.active)?.parsed ?? null
  return <Shell view={view} navigate={navigate}>
    {view === 'settings' ? <Settings snapshots={data.snapshots} />
      : view === 'route' ? <Route parsed={parsed} tasks={data.tasks} steps={data.steps} navigate={navigate} />
      : view === 'tasks' ? <Tasks tasks={data.tasks} steps={data.steps} prices={data.prices} parsed={parsed} pathname={pathname} navigate={navigate} />
      : view === 'overview' ? <Overview data={data} navigate={navigate} />
      : <Models providers={data.providers} prices={data.prices} />}
  </Shell>
}
