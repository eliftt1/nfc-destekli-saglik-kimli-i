import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Kullanıcı bilerek çıkış yaptıysa korumalı sayfalar girişe değil ana sayfaya yönlendirir.
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    // Acil durum sayfası oturum gerektirmez; gereksiz istek yapılmaz.
    if (window.location.pathname.startsWith('/e/')) {
      setLoading(false);
      return;
    }
    let active = true;
    api('/auth/me')
      .then((d) => active && setUser(d.user))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    setSignedOut(false);
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (values) => {
    const d = await api('/auth/register', { method: 'POST', body: values });
    setSignedOut(false);
    setUser(d.user);
    return d.user;
  }, []);

  /** Oturumu yalnızca istemcide kapatır (sunucu tarafı zaten kapandıysa, ör. hesap silme). */
  const endSession = useCallback(() => {
    setSignedOut(true);
    setUser(null);
  }, []);

  /** Sunucudaki oturumu kapatır. İstek başarısız olursa hata fırlatır ve kullanıcı girişli kalır:
   *  sunucuda açık kalan oturumu "kapandı" gibi göstermek yanıltıcı olurdu. */
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({ user, loading, signedOut, login, register, logout, endSession, setUser }),
    [user, loading, signedOut, login, register, logout, endSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
};
