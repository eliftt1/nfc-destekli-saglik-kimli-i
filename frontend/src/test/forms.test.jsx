import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import Register from '../pages/Register.jsx';
import Login from '../pages/Login.jsx';
import ForgotPassword from '../pages/ForgotPassword.jsx';
import Access from '../pages/Access.jsx';
import { json, mockApi, renderRoute } from './utils.jsx';

const fillRegister = async (u, over = {}) => {
  const v = { name: 'Ayşe Yılmaz', email: 'ayse@example.com', pw: 'GucluSifre123', pw2: 'GucluSifre123', ...over };
  await u.type(screen.getByLabelText('Ad soyad'), v.name);
  await u.type(screen.getByLabelText('E-posta'), v.email);
  await u.type(screen.getByLabelText(/^Şifre$/), v.pw);
  await u.type(screen.getByLabelText('Şifre tekrar'), v.pw2);
};
const consents = () => ({
  privacy: screen.getByRole('checkbox', { name: /Aydınlatma metnini okudum/ }),
  health: screen.getByRole('checkbox', { name: /açık rıza veriyorum/ }),
});

describe('Kayıt formu', () => {
  it('boş gönderimde alan hatalarını gösterir ve istek yapmaz', async () => {
    const f = mockApi();
    renderRoute(<Register />, { path: '/register', route: '/register' });
    await userEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }));
    expect(await screen.findAllByText('Bu alan zorunlu.')).not.toHaveLength(0);
    expect(screen.getAllByText('Devam etmek için bu onay gerekli.')).toHaveLength(2);
    expect(f.calls.some((c) => c.url === '/api/auth/register')).toBe(false);
  });

  it('açık rıza ve aydınlatma onayları ayrı ayrı istenir', async () => {
    const f = mockApi();
    const u = userEvent.setup();
    renderRoute(<Register />, { path: '/register', route: '/register' });
    await fillRegister(u);
    await u.click(consents().privacy); // yalnızca aydınlatma
    await u.click(screen.getByRole('button', { name: 'Hesap oluştur' }));
    expect(await screen.findAllByText('Devam etmek için bu onay gerekli.')).toHaveLength(1);
    expect(consents().health).toHaveAttribute('aria-invalid', 'true');
    expect(consents().privacy).not.toHaveAttribute('aria-invalid');
    expect(f.calls.some((c) => c.url === '/api/auth/register')).toBe(false);
  });

  it('şifre eşleşmezse uyarır', async () => {
    mockApi();
    const u = userEvent.setup();
    renderRoute(<Register />, { path: '/register', route: '/register' });
    await fillRegister(u, { pw2: 'Baska12345678' });
    await u.click(consents().privacy);
    await u.click(consents().health);
    await u.click(screen.getByRole('button', { name: 'Hesap oluştur' }));
    expect(await screen.findByText('Şifreler eşleşmiyor.')).toBeInTheDocument();
  });

  it('geçerli formu API\'ye gönderir (CSRF başlığıyla) ve profil sayfasına yönlendirir', async () => {
    const f = mockApi({
      'POST /api/auth/register': ({ body }) => json(201, { user: { id: '1', email: body.email, fullName: body.fullName }, csrfToken: 'yeni' }),
    });
    const u = userEvent.setup();
    renderRoute(<Register />, { path: '/register', route: '/register' });
    await fillRegister(u);
    await u.click(consents().privacy);
    await u.click(consents().health);
    await u.click(screen.getByRole('button', { name: 'Hesap oluştur' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/dashboard/profile'));
    const call = f.calls.find((c) => c.url === '/api/auth/register');
    expect(call.headers['x-csrf-token']).toBe('test-csrf');
    expect(call.body).toMatchObject({ fullName: 'Ayşe Yılmaz', email: 'ayse@example.com', acceptPrivacy: true, acceptHealthData: true });
  });

  it('e-posta kullanımdaysa alanın altında gösterir', async () => {
    mockApi({ 'POST /api/auth/register': json(409, { error: { code: 'EMAIL_TAKEN', message: 'x', fields: { email: 'email_taken' } } }) });
    const u = userEvent.setup();
    renderRoute(<Register />, { path: '/register', route: '/register' });
    await fillRegister(u);
    await u.click(consents().privacy);
    await u.click(consents().health);
    await u.click(screen.getByRole('button', { name: 'Hesap oluştur' }));
    expect((await screen.findAllByText('Bu e-posta adresi zaten kullanılıyor.')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Giriş formu', () => {
  it('hatalı bilgilerde anlaşılır mesaj gösterir', async () => {
    mockApi({ 'POST /api/auth/login': json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } }) });
    const u = userEvent.setup();
    renderRoute(<Login />, { path: '/login', route: '/login' });
    await u.type(screen.getByLabelText('E-posta'), 'ayse@example.com');
    await u.type(screen.getByLabelText('Şifre'), 'yanlis');
    await u.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-posta veya şifre hatalı.');
  });

  it('başarılı girişte panele yönlendirir; şifremi unuttum bağlantısı vardır', async () => {
    mockApi({ 'POST /api/auth/login': json(200, { user: { id: '1', email: 'a@b.co', fullName: 'A B' }, csrfToken: 'x' }) });
    const u = userEvent.setup();
    renderRoute(<Login />, { path: '/login', route: '/login' });
    expect(screen.getByRole('link', { name: 'Şifremi unuttum' })).toHaveAttribute('href', '/forgot-password');
    await u.type(screen.getByLabelText('E-posta'), 'ayse@example.com');
    await u.type(screen.getByLabelText('Şifre'), 'GucluSifre123');
    await u.click(screen.getByRole('button', { name: 'Giriş yap' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/dashboard'));
  });
});

describe('Şifremi unuttum', () => {
  it('e-posta servisi yoksa gönderildiğini İDDİA ETMEZ', async () => {
    mockApi({ 'POST /api/auth/forgot-password': { ok: true, delivery: 'not_configured' } });
    const u = userEvent.setup();
    renderRoute(<ForgotPassword />, { path: '/forgot-password', route: '/forgot-password' });
    await u.type(screen.getByLabelText('E-posta'), 'ayse@example.com');
    await u.click(screen.getByRole('button', { name: 'Sıfırlama bağlantısı iste' }));
    const msg = await screen.findByRole('status');
    expect(msg).toHaveTextContent('e-posta gönderilmedi');
    expect(msg).not.toHaveTextContent('gönderilir');
  });

  it('servis yapılandırılmışsa hesabın var olup olmadığını belli etmeyen genel mesaj gösterir', async () => {
    mockApi({ 'POST /api/auth/forgot-password': { ok: true, delivery: 'configured' } });
    const u = userEvent.setup();
    renderRoute(<ForgotPassword />, { path: '/forgot-password', route: '/forgot-password' });
    await u.type(screen.getByLabelText('E-posta'), 'kimse@example.com');
    await u.click(screen.getByRole('button', { name: 'Sıfırlama bağlantısı iste' }));
    expect(await screen.findByRole('status')).toHaveTextContent('kayıtlı bir hesap varsa');
  });
});

describe('Kısa kod girişi', () => {
  const type = async (u, v) => u.type(screen.getByLabelText('Kısa kod'), v);

  it('yazarken biçimlendirir, geçerli kodda acil durum sayfasına yönlendirir (senaryo 8, arayüz tarafı)', async () => {
    const TOKEN = 'B'.repeat(43);
    const f = mockApi({ 'POST /api/public/access': ({ body }) => (body.code === 'ABCDE-12345' ? { token: TOKEN } : json(404, { error: { code: 'CODE_INVALID' } })) });
    const u = userEvent.setup();
    renderRoute(<Access />, { path: '/access', route: '/access' });
    await type(u, 'abcde12345');
    expect(screen.getByLabelText('Kısa kod')).toHaveValue('ABCDE-12345');
    await u.click(screen.getByRole('button', { name: 'Bilgileri göster' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(`/${'e'}/${TOKEN}`));
    expect(f.calls.find((c) => c.url === '/api/public/access').body).toEqual({ code: 'ABCDE-12345' });
  });

  it('geçersiz kodda genel hata gösterir, yönlendirmez', async () => {
    mockApi({ 'POST /api/public/access': json(404, { error: { code: 'CODE_INVALID' } }) });
    const u = userEvent.setup();
    renderRoute(<Access />, { path: '/access', route: '/access' });
    await type(u, 'ZZZZZZZZZZ');
    await u.click(screen.getByRole('button', { name: 'Bilgileri göster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu kod geçersiz veya iptal edilmiş');
    expect(screen.queryByTestId('loc')).not.toBeInTheDocument();
  });

  it('hız sınırı aşıldığında ayrı bir mesaj gösterir', async () => {
    mockApi({ 'POST /api/public/access': json(429, { error: { code: 'RATE_LIMITED' } }) });
    const u = userEvent.setup();
    renderRoute(<Access />, { path: '/access', route: '/access' });
    await type(u, 'ZZZZZZZZZZ');
    await u.click(screen.getByRole('button', { name: 'Bilgileri göster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Çok fazla başarısız deneme');
  });

  it('boş kodla istek yapmaz', async () => {
    const f = mockApi();
    renderRoute(<Access />, { path: '/access', route: '/access' });
    await userEvent.click(screen.getByRole('button', { name: 'Bilgileri göster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Lütfen kodu yazın.');
    expect(f.calls.some((c) => c.url === '/api/public/access')).toBe(false);
  });
});
