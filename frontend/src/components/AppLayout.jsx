import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: 220, flex: 1, padding: '36px 40px',
        background: 'var(--bg-base)', minHeight: '100vh',
      }}>
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
