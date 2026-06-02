import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-light-bg dark:bg-dark-bg">
        <Outlet />
      </main>
    </div>
  )
}
