import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Profile from '../pages/dashboard/Profile.jsx';
import { json, mockApi, renderRoute } from './utils.jsx';

/** Gerçek backend gibi durum tutan sahte profil API'si. */
function fakeBackend(overrides = {}) {
  let n = 100;
  const state = {
    fullName: 'Ayşe Yılmaz', birthDate: '1990-05-17', bloodType: 'A+', note: 'Kalp pili var',
    visibility: { showBirthDate: false, showBloodType: true, showAllergies: true, showConditions: true, showMedications: true, showNote: true, showContacts: true },
    allergies: [{ id: 'al1', name: 'Penisilin', description: 'Döküntü' }],
    conditions: [], medications: [],
    contacts: [
      { id: 'c1', name: 'Mehmet Yılmaz', relation: 'Eş', phone: '+905321234567' },
      { id: 'c2', name: 'Fatma Yılmaz', relation: 'Anne', phone: '02125550011' },
    ],
    ...overrides,
  };
  const view = () => ({ profile: { ...state, updatedAt: '2026-10-18T09:00:00Z', completion: { percent: 50, items: [] } } });
  const lists = { allergies: 'allergies', conditions: 'conditions', medications: 'medications', contacts: 'contacts' };
  const calls = [];
  const routes = {
    'GET /api/profile': () => view(),
    'PUT /api/profile': ({ body }) => { Object.assign(state, body); return view(); },
    'PATCH /api/profile/visibility': ({ body }) => { Object.assign(state.visibility, body); return view(); },
    'PUT /api/profile/contacts/order': ({ body }) => {
      state.contacts = body.ids.map((id) => state.contacts.find((c) => c.id === id));
      return view();
    },
    __dynamic: ({ method, url, body }) => {
      const m = url.match(/^\/api\/profile\/(allergies|conditions|medications|contacts)(?:\/([\w-]+))?$/);
      if (!m) return undefined;
      const list = state[lists[m[1]]];
      calls.push({ method, url, body });
      if (method === 'POST') { list.push({ id: `n${n++}`, ...body, description: body.description || null, usage: body.usage || null }); return json(201, { item: {} }); }
      if (method === 'PUT') { Object.assign(list.find((x) => x.id === m[2]), body); return { item: {} }; }
      if (method === 'DELETE') { list.splice(list.findIndex((x) => x.id === m[2]), 1); return { ok: true }; }
      return undefined;
    },
  };
  return { state, routes, calls };
}

const setup = async (overrides, extra = {}) => {
  const be = fakeBackend(overrides);
  const api = mockApi({ ...be.routes, ...extra });
  renderRoute(<Profile />, { path: '/dashboard/profile', route: '/dashboard/profile' });
  await screen.findByRole('heading', { name: 'Sağlık profili' });
  return { be, api, u: userEvent.setup() };
};
const sw = (name) => document.querySelector(`input[name="${name}"]`);

describe('Sağlık profili sayfası', () => {
  it('kayıtlı bilgileri ve boş durumları gösterir', async () => {
    await setup();
    expect(screen.getByLabelText('Ad soyad')).toHaveValue('Ayşe Yılmaz');
    expect(screen.getByLabelText('Doğum tarihi')).toHaveValue('1990-05-17');
    expect(screen.getByLabelText('Kan grubu')).toHaveValue('A+');
    expect(screen.getByText('Penisilin')).toBeInTheDocument();
    expect(screen.getByText('Döküntü')).toBeInTheDocument();
    expect(screen.getByText('Kayıtlı hastalık yok.')).toBeInTheDocument();
    expect(screen.getByText('Kayıtlı ilaç yok.')).toBeInTheDocument();
    expect(screen.getByText('Eş, +90 532 123 45 67')).toBeInTheDocument();
  });

  it('kişisel bilgileri kaydeder ve bildirim gösterir', async () => {
    const { be, u } = await setup();
    await u.selectOptions(screen.getByLabelText('Kan grubu'), '0-');
    await u.click(screen.getByRole('button', { name: 'Kişisel bilgileri kaydet' }));
    expect(await screen.findByText('Kişisel bilgiler kaydedildi.')).toBeInTheDocument();
    expect(be.state.bloodType).toBe('0-');
    expect(be.state.fullName).toBe('Ayşe Yılmaz');
  });

  it('geçersiz kişisel bilgiyle istek göndermez', async () => {
    const { api, u } = await setup();
    await u.clear(screen.getByLabelText('Ad soyad'));
    await u.click(screen.getByRole('button', { name: 'Kişisel bilgileri kaydet' }));
    expect(await screen.findByText('Bu alan zorunlu.')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('alerji ekler, listeye yansır', async () => {
    const { be, u } = await setup();
    await u.click(screen.getByRole('button', { name: '+ Alerji ekle' }));
    await u.type(screen.getByLabelText('Madde veya ilaç adı'), 'Fıstık');
    await u.click(screen.getByRole('button', { name: 'Alerji ekle' }));
    expect(await screen.findByText('Fıstık')).toBeInTheDocument();
    expect(screen.getByText('Kayıt eklendi.')).toBeInTheDocument();
    expect(be.state.allergies.map((a) => a.name)).toEqual(['Penisilin', 'Fıstık']);
  });

  it('zorunlu alan boşken kayıt isteği göndermez', async () => {
    const { be, u } = await setup();
    await u.click(screen.getByRole('button', { name: '+ Hastalık ekle' }));
    await u.click(screen.getByRole('button', { name: 'Hastalık ekle' }));
    expect(await screen.findByText('Bu alan zorunlu.')).toBeInTheDocument();
    expect(be.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('kaydı düzenler', async () => {
    const { be, u } = await setup();
    await u.click(screen.getByRole('button', { name: 'Düzenle: Penisilin' }));
    const field = screen.getByLabelText('Madde veya ilaç adı');
    await u.clear(field);
    await u.type(field, 'Penisilin G');
    await u.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Penisilin G')).toBeInTheDocument();
    expect(be.state.allergies[0].name).toBe('Penisilin G');
  });

  it('geçersiz telefonu istemcide yakalar, geçerliyi gönderir', async () => {
    const { be, u } = await setup();
    await u.click(screen.getByRole('button', { name: 'Düzenle: Mehmet Yılmaz' }));
    const phone = screen.getByLabelText('Telefon numarası');
    await u.clear(phone);
    await u.type(phone, 'abc');
    await u.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Geçerli bir telefon numarası girin.')).toBeInTheDocument();
    expect(be.calls.some((c) => c.method === 'PUT')).toBe(false);

    await u.clear(phone);
    await u.type(phone, '0533 111 22 33');
    await u.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(be.calls.find((c) => c.method === 'PUT').body.phone).toBe('0533 111 22 33'));
  });

  it('silme önce onay ister; vazgeçince silmez, onaylayınca siler', async () => {
    const { be, u } = await setup();
    await u.click(screen.getByRole('button', { name: 'Sil: Penisilin' }));
    expect(screen.getByText('Bu kaydı silmek istiyor musunuz?')).toBeInTheDocument();
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Vazgeç' }));
    expect(be.calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Penisilin')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Sil: Penisilin' }));
    await u.click(screen.getByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(screen.queryByText('Penisilin')).not.toBeInTheDocument());
    expect(screen.getByText('Kayıtlı alerji yok.')).toBeInTheDocument();
    expect(be.state.allergies).toEqual([]);
  });

  it('göster/gizle anahtarı hemen kaydedilir', async () => {
    const { be, u } = await setup();
    expect(sw('allergies-visibility')).toBeChecked();
    await u.click(sw('allergies-visibility'));
    await waitFor(() => expect(be.state.visibility.showAllergies).toBe(false));
    expect(sw('allergies-visibility')).not.toBeChecked();
    expect(sw('showBirthDate')).not.toBeChecked(); // varsayılan: gizli
    await u.click(sw('showBirthDate'));
    await waitFor(() => expect(be.state.visibility.showBirthDate).toBe(true));
  });

  it('görünürlük kaydedilemezse anahtar eski haline döner ve hata gösterir', async () => {
    const { u } = await setup(undefined, { 'PATCH /api/profile/visibility': json(500, { error: { code: 'INTERNAL' } }) });
    await u.click(sw('allergies-visibility'));
    expect(await screen.findByText('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')).toBeInTheDocument();
    expect(sw('allergies-visibility')).toBeChecked();
  });

  it('acil durum kişilerini yeniden sıralar', async () => {
    const { be, u } = await setup();
    const items = () => screen.getAllByRole('listitem').map((li) => li.textContent).filter((x) => /Yılmaz/.test(x));
    expect(screen.getByRole('button', { name: 'Mehmet Yılmaz kişisini yukarı taşı' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fatma Yılmaz kişisini aşağı taşı' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Mehmet Yılmaz kişisini aşağı taşı' }));
    await waitFor(() => expect(be.state.contacts.map((c) => c.id)).toEqual(['c2', 'c1']));
    expect(await screen.findByText('Sıralama kaydedildi.')).toBeInTheDocument();
    expect(items()[0]).toContain('Fatma');
  });

  it('kişi sınırına ulaşılınca ekleme düğmesi yerine uyarı gösterir', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `Kişi ${i}`, relation: 'Arkadaş', phone: '5321234567' }));
    await setup({ contacts: many });
    expect(screen.queryByRole('button', { name: '+ Kişi ekle' })).not.toBeInTheDocument();
    expect(screen.getByText('En fazla 10 kayıt eklenebilir.')).toBeInTheDocument();
  });

  it('sunucu doğrulama hatasını alanın altında gösterir', async () => {
    const { u } = await setup(undefined, {
      'POST /api/profile/contacts': json(400, { error: { code: 'VALIDATION_ERROR', fields: { phone: 'invalid_phone' } } }),
    });
    await u.click(screen.getByRole('button', { name: '+ Kişi ekle' }));
    await u.type(screen.getByLabelText('Ad soyad', { selector: 'input[name="name"]' }), 'Ali Veli');
    await u.type(screen.getByLabelText('Yakınlık derecesi'), 'Kardeş');
    await u.type(screen.getByLabelText('Telefon numarası'), '5321234567');
    await u.click(screen.getByRole('button', { name: 'Kişi ekle' }));
    expect(await screen.findByText('Geçerli bir telefon numarası girin.')).toBeInTheDocument();
  });

  it('yüklenemezse hata ve tekrar dene gösterir', async () => {
    mockApi({ 'GET /api/profile': json(500, { error: { code: 'INTERNAL' } }) });
    renderRoute(<Profile />, { path: '/dashboard/profile', route: '/dashboard/profile' });
    expect(await screen.findByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
  });
});
