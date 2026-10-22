import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext.jsx';

/** Oturum yoksa girişe yönlendirir. (Gerçek yetki kontrolü her zaman backend'dedir.) */
export default function ProtectedRoute() {
  const { user, loading, signedOut } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  if (loading) return <p role="status" className="p-8 text-lg">{t('common.loading')}</p>;
  // Bilinçli çıkışta ana sayfaya, oturum süresi dolduysa girişe (geri dönülecek sayfayla) yönlendirir.
  if (!user) return signedOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
