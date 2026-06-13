import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';
import AppLayout        from './components/AppLayout';
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import GroupsPage       from './pages/GroupsPage';
import GroupDetailPage  from './pages/GroupDetailPage';
import ExpensesPage     from './pages/ExpensesPage';
import ImportPage       from './pages/ImportPage';
import BalancesPage     from './pages/BalancesPage';
import SettlementsPage  from './pages/SettlementsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected App Shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard"         element={<DashboardPage />} />
              <Route path="/groups"            element={<GroupsPage />} />
              <Route path="/groups/:id"        element={<GroupDetailPage />} />
              <Route path="/expenses"          element={<ExpensesPage />} />
              <Route path="/import"            element={<ImportPage />} />
              <Route path="/balances"          element={<BalancesPage />} />
              <Route path="/settlements"       element={<SettlementsPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
