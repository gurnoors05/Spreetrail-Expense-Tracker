import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="app-main">
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
