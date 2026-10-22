import { afterEach, describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Emergency from '../pages/Emergency.jsx';
import { json, mockApi, renderRoute } from './utils.jsx';

const TOKEN = 'A'.repeat(43);
const full = {
  fullName: 'Ayşe Yılmaz',
  birthDate: '1990-05-17',
  bloodType: 'A+',
  note: 'Kalp pili var',
  allergies: [{ name: 'Penisilin', description: 'Döküntü' }],
  conditions: [{ name: 'Tip 1 diyabet' }],
  medications: [{ name: 'İnsülin', usage: 'Günde 3 kez' }],
  contacts: [
    { name: 'Mehmet Yılmaz', relation: 'Eş', phone: '+905321234567' },
    { name: 'Fatma Yılmaz', relation: 'Anne', phone: '02125550011' },
  ],
  updatedAt: '2026-10-18T09:30:00.000Z',
};
// AuthProvider "bu bir /e/ sayfası mı" kontrolünü gerçek tarayıcı adresinden yapar; testte de onu ayarlıyoruz.
const open = (opts) => {
  window.history.pushState({}, '', `/e/${TOKEN}`);
  return renderRoute(<Emergency />, { path: '/e/:token', route: `/e/${TOKEN}`, ...opts });
};

afterEach(() => window.history.pushState({}, '', '/'));

describe('Acil durum sayfası', () => {
  it('giriş yapmadan tüm izin verilen bilgileri gösterir', async () => {
    const f = mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: full } });
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })).toBeInTheDocument();
    for (const text of ['A+', 'Penisilin', 'Döküntü', 'İnsülin', 'Günde 3 kez', 'Tip 1 diyabet', 'Kalp pili var', '17 Mayıs 1990']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText(/36 yaşında|35 yaşında/)).toBeInTheDocument();
    // /e/ yolunda oturum sorgusu yapılmaz; yalnızca acil durum verisi istenir
    await waitFor(() => expect(f.calls.length).toBeGreaterThan(0));
    expect(f.calls.map((c) => c.url)).toEqual([`/api/public/emergency/${TOKEN}`]);
  });

  it('her kişi için tel: bağlantısı doğru numarayı kullanır (senaryo 10)', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: full } });
    open();
    await screen.findByText('Penisilin');
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('tel:') && a.getAttribute('href') !== 'tel:112');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['tel:+905321234567', 'tel:02125550011']);
    expect(within(links[0]).getByText(/Ara: Mehmet Yılmaz/)).toBeInTheDocument();
    expect(within(links[0]).getByText(/Eş, \+90 532 123 45 67/)).toBeInTheDocument();
    expect(links[1]).toHaveAccessibleName(/Fatma Yılmaz.*Anne.*0212 555 00 11/);
    expect(screen.getByRole('link', { name: /112/ })).toHaveAttribute('href', 'tel:112');
  });

  it('API\'nin göndermediği alanlar için başlık veya boş kutu çizmez (senaryo 5, arayüz tarafı)', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: { fullName: 'Ayşe Yılmaz', allergies: [{ name: 'Fıstık' }], updatedAt: full.updatedAt } } });
    open();
    await screen.findByText('Fıstık');
    for (const hidden of ['Kan grubu', 'Doğum tarihi', 'Düzenli kullanılan ilaçlar', 'Kronik hastalıklar', 'Acil durum notu', 'Acil durumda aranacak kişiler']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
    expect(screen.getByText('Alerjiler')).toBeInTheDocument();
    expect(screen.queryByText(/ek bilgi eklememiş/)).not.toBeInTheDocument();
  });

  it('yalnızca ad varsa bunu açıkça söyler', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: { fullName: 'Ayşe Yılmaz', updatedAt: full.updatedAt } } });
    open();
    expect(await screen.findByText(/ek bilgi eklememiş/)).toBeInTheDocument();
  });

  it('uyarı metnini ve son güncelleme tarihini gösterir', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: full } });
    open();
    expect(await screen.findByText(/doğrulanmış bir tıbbi kayıt yerine geçmez/)).toBeInTheDocument();
    expect(screen.getByText(/Son güncelleme:/)).toBeInTheDocument();
  });

  it('geçersiz/iptal edilmiş token sağlık bilgisi göstermez (senaryo 7, arayüz tarafı)', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: json(404, { error: { code: 'TAG_INVALID', message: 'x' } }) });
    open();
    expect(await screen.findByRole('heading', { name: 'Bu bağlantı geçersiz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kısa kod gir' })).toHaveAttribute('href', '/access');
    expect(screen.queryByText('Penisilin')).not.toBeInTheDocument();
  });

  it('ağ hatasında tekrar dene düğmesi gösterir ve yeniden yükler', async () => {
    let n = 0;
    mockApi({
      [`GET /api/public/emergency/${TOKEN}`]: () => (++n === 1 ? json(500, { error: { code: 'INTERNAL' } }) : { profile: full }),
    });
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByText('Penisilin')).toBeInTheDocument();
  });

  it('kısa kodla gelindiğinde istek via=code ile yapılır', async () => {
    const f = mockApi({ [`GET /api/public/emergency/${TOKEN}?via=code`]: { profile: full } });
    open({ state: { via: 'code' } });
    await screen.findByText('Penisilin');
    expect(f.calls[0].url).toBe(`/api/public/emergency/${TOKEN}?via=code`);
  });

  it('noindex meta etiketi eklenir ve sayfadan çıkınca kaldırılır', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: full } });
    const { unmount } = open();
    await screen.findByText('Penisilin');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('dil İngilizceye çevrilebilir', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: full } });
    open();
    await screen.findByText('Penisilin');
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(await screen.findByText('Allergies')).toBeInTheDocument();
    expect(screen.getByText(/Call: Mehmet Yılmaz/)).toBeInTheDocument();
    expect(screen.getByText(/17 May 1990/)).toBeInTheDocument();
  });

  it('kullanıcı girdisini HTML olarak yorumlamaz (XSS)', async () => {
    mockApi({ [`GET /api/public/emergency/${TOKEN}`]: { profile: { fullName: '<img src=x onerror=alert(1)>', note: '<script>alert(1)</script>', updatedAt: full.updatedAt } } });
    const { container } = open();
    await screen.findByRole('heading', { level: 1 });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
});
