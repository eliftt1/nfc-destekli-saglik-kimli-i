import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import Tags from '../pages/dashboard/Tags.jsx';
import Overview from '../pages/dashboard/Overview.jsx';
import AccessLogs from '../pages/dashboard/AccessLogs.jsx';
import Settings from '../pages/dashboard/Settings.jsx';
import Emergency from '../pages/Emergency.jsx';
import { json, mockApi, renderRoute } from './utils.jsx';

const TOKEN = 'T'.repeat(43);
const tag = (over = {}) => ({
  id: 't1', label: 'Acil durum etiketi', status: 'ACTIVE', createdAt: '2026-10-01T10:00:00Z', revokedAt: null,
  url: `https://acil.example.com/e/${TOKEN}`, shortCode: '6RR8W-N2441', ...over,
});
const USER = { id: 'u1', email: 'ayse@example.com', fullName: 'Ayşe Yılmaz' };

afterEach(() => vi.unstubAllGlobals());

describe('Etiket yönetimi', () => {
  it('etiket yokken boş durum gösterir, oluşturunca bağlantı ve kısa kod çıkar', async () => {
    let tags = [];
    mockApi({
      'GET /api/tags': () => ({ tags }),
      'POST /api/tags': () => { tags = [tag()]; return json(201, { tag: tags[0] }); },
    });
    const u = userEvent.setup();
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    expect(await screen.findByText('Henüz bir acil durum bağlantınız yok.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Bağlantı oluştur' }));
    expect(await screen.findByDisplayValue(`https://acil.example.com/e/${TOKEN}`)).toBeInTheDocument();
    expect(screen.getByDisplayValue('6RR8W-N2441')).toBeInTheDocument();
    expect(screen.getByText('Bağlantı oluşturuldu.')).toBeInTheDocument();
  });

  it('QR kod gerçekten bağlantıyı taşır ve o bağlantı acil durum sayfasını açar (senaryo 11)', async () => {
    mockApi({
      'GET /api/tags': { tags: [tag()] },
      [`GET /api/public/emergency/${TOKEN}`]: { profile: { fullName: 'Ayşe Yılmaz', bloodType: 'A+', updatedAt: '2026-10-18T09:00:00Z' } },
    });
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    const img = await screen.findByAltText('Acil durum bağlantısını içeren QR kod');

    // 1) İndirilen PNG'yi gerçekten çöz
    const src = img.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);
    const png = PNG.sync.read(Buffer.from(src.split(',')[1], 'base64'));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded).not.toBeNull();
    expect(decoded.data).toBe(`https://acil.example.com/e/${TOKEN}`);

    // 2) İndirme bağlantısı aynı PNG'dir
    const dl = screen.getByRole('link', { name: 'QR kodu PNG olarak indir' });
    expect(dl).toHaveAttribute('download', 'acil-kunye-qr.png');
    expect(dl).toHaveAttribute('href', src);

    // 3) QR'ın içindeki yol acil durum sayfasını açar
    const path = new URL(decoded.data).pathname;
    expect(path).toBe(`/e/${TOKEN}`);
    window.history.pushState({}, '', path);
    renderRoute(<Emergency />, { path: '/e/:token', route: path });
    expect(await screen.findByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('bağlantıyı panoya kopyalar', async () => {
    const writeText = vi.fn().mockResolvedValue();
    mockApi({ 'GET /api/tags': { tags: [tag()] } });
    const u = userEvent.setup();
    // user-event kendi pano taklidini kurar; bizimki ondan SONRA tanımlanmalı.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    await screen.findByDisplayValue(`https://acil.example.com/e/${TOKEN}`);
    await u.click(screen.getAllByRole('button', { name: 'Kopyala' })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`https://acil.example.com/e/${TOKEN}`));
    expect(await screen.findByText('Kopyalandı.')).toBeInTheDocument();
  });

  it('kopyalama başarısızsa bunu söyler', async () => {
    mockApi({ 'GET /api/tags': { tags: [tag()] } });
    const u = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('x')) }, configurable: true });
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    await screen.findByDisplayValue(`https://acil.example.com/e/${TOKEN}`);
    await u.click(screen.getAllByRole('button', { name: 'Kopyala' })[0]);
    expect(await screen.findByText(/Kopyalanamadı/)).toBeInTheDocument();
  });

  it('localhost bağlantısı için telefonla çalışmayacağını uyarır; https için uyarmaz', async () => {
    mockApi({ 'GET /api/tags': { tags: [tag({ url: `http://localhost:5173/e/${TOKEN}` })] } });
    const { unmount } = renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    expect(await screen.findByText(/yalnızca bu bilgisayarda çalışır/)).toBeInTheDocument();
    unmount();
    mockApi({ 'GET /api/tags': { tags: [tag()] } });
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    await screen.findByDisplayValue(`https://acil.example.com/e/${TOKEN}`);
    expect(screen.queryByText(/yalnızca bu bilgisayarda çalışır/)).not.toBeInTheDocument();
  });

  it('NFC yazma talimatlarını ve etikete yalnızca bağlantı yazılacağını gösterir', async () => {
    mockApi({ 'GET /api/tags': { tags: [tag()] } });
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    expect(await screen.findByText('NFC etikete nasıl yazılır?')).toBeInTheDocument();
    expect(screen.getByText(/NTAG213, NTAG215 veya NTAG216/)).toBeInTheDocument();
    expect(screen.getByText(/NFC Tools/)).toBeInTheDocument();
    expect(screen.getByText(/Etikete yalnızca bu bağlantı yazılmalıdır/)).toBeInTheDocument();
  });

  it('yenileme onay ister; onaylanınca yeni bağlantıyı gösterir', async () => {
    const NEW = 'N'.repeat(43);
    let current = tag();
    const f = mockApi({
      'GET /api/tags': () => ({ tags: [current] }),
      'POST /api/tags/t1/regenerate': () => { current = tag({ id: 't2', url: `https://acil.example.com/e/${NEW}`, shortCode: 'AAAAA-BBBBB' }); return json(201, { tag: current }); },
    });
    const u = userEvent.setup();
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    await screen.findByDisplayValue(`https://acil.example.com/e/${TOKEN}`);
    await u.click(screen.getByRole('button', { name: 'Yeni bağlantı oluştur' }));
    expect(f.calls.some((c) => c.url.includes('regenerate'))).toBe(false); // henüz değil
    expect(screen.getByText(/Eski bağlantı ve kısa kod hemen iptal edilecek/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Evet, yenile' }));
    expect(await screen.findByDisplayValue(`https://acil.example.com/e/${NEW}`)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(`https://acil.example.com/e/${TOKEN}`)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('AAAAA-BBBBB')).toBeInTheDocument();
  });

  it('iptal onay ister; iptalden sonra bağlantı kalkar ve geçmişte görünür', async () => {
    let tags = [tag()];
    mockApi({
      'GET /api/tags': () => ({ tags }),
      'POST /api/tags/t1/revoke': () => { tags = [tag({ status: 'REVOKED', url: undefined, shortCode: undefined, revokedAt: '2026-10-18T10:00:00Z' })]; return { tag: tags[0] }; },
    });
    const u = userEvent.setup();
    renderRoute(<Tags />, { path: '/dashboard/tags', route: '/dashboard/tags' });
    await screen.findByDisplayValue(`https://acil.example.com/e/${TOKEN}`);
    await u.click(screen.getByRole('button', { name: 'Bağlantıyı iptal et' }));
    await u.click(screen.getByRole('button', { name: 'Evet, iptal et' }));
    expect(await screen.findByText('Henüz bir acil durum bağlantınız yok.')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(`https://acil.example.com/e/${TOKEN}`)).not.toBeInTheDocument();
    expect(screen.getByText('İptal edilmiş bağlantılar')).toBeInTheDocument();
    expect(screen.getByText(/tarihinde iptal edildi/)).toBeInTheDocument();
  });
});

describe('Genel bakış', () => {
  const profile = (percent, items) => ({ profile: { completion: { percent, items } } });
  it('tamamlanma yüzdesini ve eksikleri gösterir; bağlantı yoksa oluşturma yolunu verir', async () => {
    mockApi({
      'GET /api/profile': profile(25, [
        { key: 'birthDate', done: true }, { key: 'bloodType', done: false }, { key: 'healthInfo', done: false }, { key: 'contact', done: false },
      ]),
      'GET /api/tags': { tags: [] },
      'GET /api/access-logs?limit=5': { logs: [], nextCursor: null },
    });
    renderRoute(<Overview />, { path: '/dashboard', route: '/dashboard' });
    expect(await screen.findByRole('progressbar', { name: 'Profil tamamlanma durumu' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('Kan grubunuzu seçin')).toBeInTheDocument();
    expect(screen.getByText('En az bir acil durum kişisi ekleyin')).toBeInTheDocument();
    expect(screen.queryByText('Doğum tarihinizi ekleyin')).not.toBeInTheDocument(); // tamamlanan listelenmez
    expect(screen.getByRole('link', { name: 'Bağlantı oluştur' })).toHaveAttribute('href', '/dashboard/tags');
    expect(screen.getByText('Sayfanız henüz hiç açılmadı.')).toBeInTheDocument();
  });

  it('aktif bağlantı için kısa kodu, önizlemeyi ve son erişimi gösterir', async () => {
    mockApi({
      'GET /api/profile': profile(100, []),
      'GET /api/tags': { tags: [tag()] },
      'GET /api/access-logs?limit=5': { logs: [{ id: 'l1', kind: 'LINK', ipPrefix: '127.0.0.0/24', accessedAt: '2026-10-18T09:30:00Z', tagLabel: 'x' }], nextCursor: null },
    });
    renderRoute(<Overview />, { path: '/dashboard', route: '/dashboard' });
    expect(await screen.findByText('6RR8W-N2441')).toBeInTheDocument();
    expect(screen.getByText('Profiliniz tamamlandı.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sayfayı önizle' })).toHaveAttribute('href', `/e/${TOKEN}`);
    expect(screen.getByText('Son erişim:')).toBeInTheDocument();
    expect(screen.getByText('Önizleme de erişim geçmişinde görünür.')).toBeInTheDocument();
  });
});

describe('Erişim geçmişi', () => {
  it('erişim türünü ve ağ bilgisini gösterir, daha fazlasını sayfalar', async () => {
    mockApi({
      'GET /api/access-logs?limit=20': { logs: [
        { id: 'a', kind: 'LINK', ipPrefix: '203.0.113.0/24', accessedAt: '2026-10-18T09:30:00Z', tagLabel: 'x' },
        { id: 'b', kind: 'SHORT_CODE', ipPrefix: null, accessedAt: '2026-10-17T09:30:00Z', tagLabel: 'x' },
      ], nextCursor: 'cur1' },
      'GET /api/access-logs?limit=20&cursor=cur1': { logs: [{ id: 'c', kind: 'LINK', ipPrefix: null, accessedAt: '2026-10-16T09:30:00Z', tagLabel: 'x' }], nextCursor: null },
    });
    const u = userEvent.setup();
    renderRoute(<AccessLogs />, { path: '/dashboard/access-logs', route: '/dashboard/access-logs' });
    expect(await screen.findByText('Ağ: 203.0.113.0/24')).toBeInTheDocument();
    expect(screen.getByText('Kısa kod')).toBeInTheDocument();
    expect(screen.getAllByText('Bağlantı (NFC veya QR)')).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: 'Daha fazla göster' }));
    await waitFor(() => expect(screen.getAllByText('Bağlantı (NFC veya QR)')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).not.toBeInTheDocument();
  });

  it('kayıt yoksa boş durumu gösterir ve sağlık verisi yazılmadığını söyler', async () => {
    mockApi({ 'GET /api/access-logs?limit=20': { logs: [], nextCursor: null } });
    renderRoute(<AccessLogs />, { path: '/dashboard/access-logs', route: '/dashboard/access-logs' });
    expect(await screen.findByText('Sayfanız henüz hiç açılmadı.')).toBeInTheDocument();
    expect(screen.getByText(/Sağlık bilgileriniz bu kayıtlara yazılmaz/)).toBeInTheDocument();
  });
});

describe('Hesap ayarları', () => {
  const account = { account: { email: 'ayse@example.com', fullName: 'Ayşe Yılmaz', createdAt: '2026-10-01T10:00:00Z', consents: { privacyAcceptedAt: '2026-10-01T10:00:00Z', healthConsentAt: '2026-10-01T10:00:00Z', consentVersion: '2026-10-v1' } } };
  const base = { 'GET /api/account': account };
  const setup = (extra = {}) => {
    const f = mockApi({ ...base, ...extra });
    renderRoute(<Settings />, { path: '/dashboard/settings', route: '/dashboard/settings' });
    return { f, u: userEvent.setup() };
  };

  it('hesap bilgilerini ve onay kaydını gösterir', async () => {
    setup();
    expect(await screen.findByText('ayse@example.com')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-v1 sürümü/)).toBeInTheDocument();
  });

  it('şifre değiştirir; eşleşmeyen yeni şifreyle istek göndermez', async () => {
    const { f, u } = setup({ 'POST /api/auth/change-password': { ok: true } });
    await screen.findByText('ayse@example.com');
    await u.type(screen.getByLabelText('Mevcut şifre'), 'GucluSifre123');
    await u.type(screen.getByLabelText('Yeni şifre'), 'YeniGucluSifre1');
    await u.type(screen.getByLabelText('Yeni şifre tekrar'), 'Baska12345678');
    await u.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
    expect(await screen.findByText('Şifreler eşleşmiyor.')).toBeInTheDocument();
    expect(f.calls.some((c) => c.url.includes('change-password'))).toBe(false);

    await u.clear(screen.getByLabelText('Yeni şifre tekrar'));
    await u.type(screen.getByLabelText('Yeni şifre tekrar'), 'YeniGucluSifre1');
    await u.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
    expect(await screen.findByText(/Şifreniz değiştirildi/)).toBeInTheDocument();
    expect(f.calls.find((c) => c.url.includes('change-password')).body).toEqual({
      currentPassword: 'GucluSifre123', newPassword: 'YeniGucluSifre1', newPasswordConfirm: 'YeniGucluSifre1',
    });
  });

  it('yanlış mevcut şifreyi alanın altında gösterir', async () => {
    const { u } = setup({ 'POST /api/auth/change-password': json(400, { error: { code: 'WRONG_CURRENT_PASSWORD', fields: { currentPassword: 'wrong_password' } } }) });
    await screen.findByText('ayse@example.com');
    await u.type(screen.getByLabelText('Mevcut şifre'), 'Yanlis12345');
    await u.type(screen.getByLabelText('Yeni şifre'), 'YeniGucluSifre1');
    await u.type(screen.getByLabelText('Yeni şifre tekrar'), 'YeniGucluSifre1');
    await u.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
    expect(await screen.findByText('Şifre hatalı.')).toBeInTheDocument();
  });

  it('hesap silme açık onay ve şifre ister; onay kutusu olmadan istek göndermez', async () => {
    const { f, u } = setup({ 'DELETE /api/account': { ok: true, csrfToken: 'x' } });
    await screen.findByText('ayse@example.com');
    await u.click(screen.getByRole('button', { name: 'Hesabımı sil' }));
    const form = screen.getByRole('form', { name: 'Hesabı sil' });
    await u.type(within(form).getByLabelText('Onaylamak için şifrenizi girin'), 'GucluSifre123');
    await u.click(within(form).getByRole('button', { name: 'Hesabımı kalıcı olarak sil' }));
    expect(await within(form).findByText('Devam etmek için bu onay gerekli.')).toBeInTheDocument();
    expect(f.calls.some((c) => c.method === 'DELETE')).toBe(false);

    await u.click(within(form).getByRole('checkbox'));
    await u.click(within(form).getByRole('button', { name: 'Hesabımı kalıcı olarak sil' }));
    await waitFor(() => expect(f.calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(f.calls.find((c) => c.method === 'DELETE').body).toEqual({ password: 'GucluSifre123' });
  });

  it('hesap silmede yanlış şifreyi gösterir ve hesap silinmez', async () => {
    const { u } = setup({ 'DELETE /api/account': json(400, { error: { code: 'WRONG_CURRENT_PASSWORD', fields: { password: 'wrong_password' } } }) });
    await screen.findByText('ayse@example.com');
    await u.click(screen.getByRole('button', { name: 'Hesabımı sil' }));
    const form = screen.getByRole('form', { name: 'Hesabı sil' });
    await u.click(within(form).getByRole('checkbox'));
    await u.type(within(form).getByLabelText('Onaylamak için şifrenizi girin'), 'Yanlis12345');
    await u.click(within(form).getByRole('button', { name: 'Hesabımı kalıcı olarak sil' }));
    expect(await within(form).findByText('Şifre hatalı.')).toBeInTheDocument();
    expect(screen.queryByTestId('loc')).not.toBeInTheDocument();
  });

  it('sağlık verilerinin silinmesini şifreyle talep eder', async () => {
    const { f, u } = setup({ 'DELETE /api/account/health-data': { ok: true } });
    await screen.findByText('ayse@example.com');
    await u.click(screen.getByRole('button', { name: 'Sağlık verilerimi sil' }));
    const form = screen.getByRole('form', { name: 'Kişisel verilerimin silinmesini talep et' });
    await u.type(within(form).getByLabelText('Onaylamak için şifrenizi girin'), 'GucluSifre123');
    await u.click(within(form).getByRole('button', { name: 'Verilerimi kalıcı olarak sil' }));
    expect(await screen.findByText(/sağlık verileriniz silindi/i)).toBeInTheDocument();
    expect(f.calls.find((c) => c.url === '/api/account/health-data').body).toEqual({ password: 'GucluSifre123' });
  });
});

describe('Korumalı panel yönlendirmesi', () => {
  const renderApp = (route) =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>,
    );

  it('oturum yoksa /dashboard girişe yönlendirir', async () => {
    mockApi(); // /me → 401
    renderApp('/dashboard/profile');
    expect(await screen.findByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });

  it('oturum varsa paneli, yan menüyü ve alt gezinmeyi gösterir', async () => {
    mockApi({
      'GET /api/auth/me': { user: USER },
      'GET /api/profile': { profile: { completion: { percent: 0, items: [] } } },
      'GET /api/tags': { tags: [] },
      'GET /api/access-logs?limit=5': { logs: [], nextCursor: null },
    });
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Merhaba, Ayşe Yılmaz' })).toBeInTheDocument();
    // masaüstü yan menüsü + mobil alt gezinme
    expect(screen.getAllByRole('navigation', { name: 'Panel menüsü' })).toHaveLength(2);
    for (const name of ['Genel bakış', 'Sağlık profili', 'Bağlantı ve QR', 'Erişim geçmişi', 'Ayarlar']) {
      expect(screen.getAllByRole('link', { name })).toHaveLength(2);
    }
  });

  it('çıkış yapınca ana sayfaya döner', async () => {
    mockApi({
      'GET /api/auth/me': { user: USER },
      'GET /api/profile': { profile: { completion: { percent: 0, items: [] } } },
      'GET /api/tags': { tags: [] },
      'GET /api/access-logs?limit=5': { logs: [], nextCursor: null },
      'POST /api/auth/logout': { ok: true, csrfToken: 'x' },
    });
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Merhaba, Ayşe Yılmaz' });
    await userEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }));
    expect(await screen.findByRole('heading', { name: /Sağlık bilgileriniz/ })).toBeInTheDocument();
    // çıkıştan sonra panele doğrudan gitmek girişe yönlendirir
    expect(screen.queryByRole('heading', { name: 'Giriş yap' })).not.toBeInTheDocument();
  });

  it('hesap silinince giriş sayfasına değil ana sayfaya düşer ve panel artık açılmaz', async () => {
    mockApi({
      'GET /api/auth/me': { user: USER },
      'GET /api/account': { account: { email: 'ayse@example.com', fullName: 'Ayşe Yılmaz', createdAt: '2026-10-01T10:00:00Z', consents: { privacyAcceptedAt: '2026-10-01T10:00:00Z', healthConsentAt: '2026-10-01T10:00:00Z', consentVersion: '2026-10-v1' } } },
      'DELETE /api/account': { ok: true, csrfToken: 'x' },
    });
    const u = userEvent.setup();
    renderApp('/dashboard/settings');
    await screen.findByText('ayse@example.com');
    await u.click(screen.getByRole('button', { name: 'Hesabımı sil' }));
    const form = screen.getByRole('form', { name: 'Hesabı sil' });
    await u.click(within(form).getByRole('checkbox'));
    await u.type(within(form).getByLabelText('Onaylamak için şifrenizi girin'), 'GucluSifre123');
    await u.click(within(form).getByRole('button', { name: 'Hesabımı kalıcı olarak sil' }));
    expect(await screen.findByRole('heading', { name: /Sağlık bilgileriniz/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Giriş yap' })).not.toBeInTheDocument();
  });

  it('çıkış isteği başarısız olursa kullanıcı girişli kalır ve hata görür', async () => {
    mockApi({
      'GET /api/auth/me': { user: USER },
      'GET /api/profile': { profile: { completion: { percent: 0, items: [] } } },
      'GET /api/tags': { tags: [] },
      'GET /api/access-logs?limit=5': { logs: [], nextCursor: null },
      'POST /api/auth/logout': json(500, { error: { code: 'INTERNAL' } }),
    });
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Merhaba, Ayşe Yılmaz' });
    await userEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }));
    expect(await screen.findByText('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Merhaba, Ayşe Yılmaz' })).toBeInTheDocument();
  });
});
