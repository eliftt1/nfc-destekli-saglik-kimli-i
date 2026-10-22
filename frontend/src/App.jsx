import { Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Privacy from './pages/Privacy.jsx';
import Access from './pages/Access.jsx';
import Emergency from './pages/Emergency.jsx';
import NotFound from './pages/NotFound.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Profile from './pages/dashboard/Profile.jsx';
import Tags from './pages/dashboard/Tags.jsx';
import AccessLogs from './pages/dashboard/AccessLogs.jsx';
import Settings from './pages/dashboard/Settings.jsx';

export default function App() {
  return (
    <Routes>
      {/* Acil durum sayfası kendi sade düzenine sahiptir ve giriş gerektirmez. */}
      <Route path="/e/:token" element={<Emergency />} />
      {/* Panel: oturum gerektirir. Gerçek yetki kontrolü backend'dedir. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/dashboard/tags" element={<Tags />} />
          <Route path="/dashboard/access-logs" element={<AccessLogs />} />
          <Route path="/dashboard/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/access" element={<Access />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
