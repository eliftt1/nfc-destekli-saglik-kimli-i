import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client.js';
import { apiErrorText } from '../../lib/errors.js';
import { checkBirthDate, checkName, checkOptional } from '../../lib/validate.js';
import { formatPhone } from '../../lib/format.js';
import ListSection from '../../components/ListSection.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Button, Card, LoadError, LoadingBlock, TextField, VisibilityToggle } from '../../components/ui.jsx';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'UNKNOWN'];
export const LIMITS = { allergies: 30, conditions: 30, medications: 30, contacts: 10 };

function PersonalForm({ profile, onSaved, visibility, setVisibility }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [v, setV] = useState({
    fullName: profile.fullName ?? '', birthDate: profile.birthDate ?? '', bloodType: profile.bloodType ?? '', note: profile.note ?? '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e) {
    e.preventDefault();
    const errs = Object.fromEntries(
      Object.entries({ fullName: checkName(v.fullName), birthDate: checkBirthDate(v.birthDate), note: checkOptional(v.note, 500) }).filter(([, x]) => x),
    );
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const d = await api('/profile', {
        method: 'PUT',
        body: { fullName: v.fullName.trim(), birthDate: v.birthDate || null, bloodType: v.bloodType || null, note: v.note.trim() || null },
      });
      onSaved(d.profile);
      toast.success(t('profile.personal.saved'));
    } catch (err) {
      setErrors(err.fields ?? {});
      toast.error(apiErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const bloodId = 'bloodType';
  return (
    <Card>
      <form onSubmit={submit} noValidate className="space-y-5" aria-labelledby="personal-heading">
        <h2 id="personal-heading" className="text-xl font-bold">{t('profile.personal.title')}</h2>
        <div>
          <TextField name="fullName" label={t('profile.personal.fullName')} value={v.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="name" />
          <p className="mt-1 text-sm text-slate">{t('profile.visibility.nameAlways')}</p>
        </div>
        <div>
          <TextField name="birthDate" type="date" max={today} label={t('profile.personal.birthDate')} value={v.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
          <VisibilityToggle name="showBirthDate" checked={visibility.showBirthDate} onChange={(c) => setVisibility('showBirthDate', c)} label={t('profile.visibility.label')} />
        </div>
        <div>
          <label htmlFor={bloodId} className="mb-1 block text-base font-bold">{t('profile.personal.bloodType')}</label>
          <select id={bloodId} name="bloodType" value={v.bloodType} onChange={set('bloodType')} className="min-h-12 w-full rounded-lg border-2 border-line bg-white px-3 text-base">
            <option value="">{t('profile.personal.bloodNone')}</option>
            {BLOOD.map((b) => (
              <option key={b} value={b}>{b === 'UNKNOWN' ? t('profile.personal.bloodUnknown') : b}</option>
            ))}
          </select>
          <VisibilityToggle name="showBloodType" checked={visibility.showBloodType} onChange={(c) => setVisibility('showBloodType', c)} label={t('profile.visibility.label')} />
        </div>
        <div>
          <label htmlFor="note" className="mb-1 block text-base font-bold">{t('profile.personal.note')}</label>
          <textarea
            id="note" name="note" rows={3} maxLength={500} value={v.note} onChange={set('note')}
            aria-describedby="note-hint"
            className="w-full rounded-lg border-2 border-line bg-white p-3 text-base"
          />
          <p id="note-hint" className="mt-1 text-sm text-slate">{t('profile.personal.noteHint')} ({v.note.length}/500)</p>
          <VisibilityToggle name="showNote" checked={visibility.showNote} onChange={(c) => setVisibility('showNote', c)} label={t('profile.visibility.label')} />
        </div>
        <Button type="submit" loading={busy}>{t('profile.personal.save')}</Button>
      </form>
    </Card>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('/profile');
      setProfile(d.profile);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Anahtar hemen kaydedilir; başarısız olursa eski haline döner.
  async function setVisibility(key, value) {
    const previous = profile.visibility;
    setProfile((p) => ({ ...p, visibility: { ...p.visibility, [key]: value } }));
    try {
      await api('/profile/visibility', { method: 'PATCH', body: { [key]: value } });
      toast.success(t('profile.visibility.updated'));
    } catch (err) {
      setProfile((p) => ({ ...p, visibility: previous }));
      toast.error(apiErrorText(t, err));
    }
  }

  async function reorder(ids) {
    try {
      const d = await api('/profile/contacts/order', { method: 'PUT', body: { ids } });
      setProfile(d.profile);
      toast.success(t('profile.actions.orderSaved'));
    } catch (err) {
      toast.error(apiErrorText(t, err));
      load();
    }
  }

  if (failed && !profile) return <LoadError onRetry={load} />;
  if (!profile) return <LoadingBlock />;
  const vis = profile.visibility;

  const L = (k) => t(`profile.lists.${k}`);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
        <p className="mt-2 max-w-prose text-slate">{t('profile.intro')}</p>
      </header>

      <PersonalForm profile={profile} onSaved={setProfile} visibility={vis} setVisibility={setVisibility} />

      <ListSection
        id="allergies" title={L('allergies.title')} emptyText={L('allergies.empty')} addLabel={L('allergies.add')}
        endpoint="allergies" max={LIMITS.allergies} items={profile.allergies}
        fields={[{ name: 'name', label: L('allergies.name'), required: true, max: 100 }, { name: 'description', label: L('allergies.description'), max: 300 }]}
        secondary={(i) => i.description} visible={vis.showAllergies} onVisibility={(c) => setVisibility('showAllergies', c)} onChanged={load}
      />
      <ListSection
        id="conditions" title={L('conditions.title')} emptyText={L('conditions.empty')} addLabel={L('conditions.add')}
        endpoint="conditions" max={LIMITS.conditions} items={profile.conditions}
        fields={[{ name: 'name', label: L('conditions.name'), required: true, max: 100 }, { name: 'description', label: L('conditions.description'), max: 300 }]}
        secondary={(i) => i.description} visible={vis.showConditions} onVisibility={(c) => setVisibility('showConditions', c)} onChanged={load}
      />
      <ListSection
        id="medications" title={L('medications.title')} emptyText={L('medications.empty')} addLabel={L('medications.add')}
        endpoint="medications" max={LIMITS.medications} items={profile.medications}
        fields={[{ name: 'name', label: L('medications.name'), required: true, max: 100 }, { name: 'usage', label: L('medications.usage'), max: 300 }]}
        secondary={(i) => i.usage} visible={vis.showMedications} onVisibility={(c) => setVisibility('showMedications', c)} onChanged={load}
      />
      <ListSection
        id="contacts" title={L('contacts.title')} emptyText={L('contacts.empty')} addLabel={L('contacts.add')} orderHint={L('contacts.orderHint')}
        endpoint="contacts" max={LIMITS.contacts} items={profile.contacts} onReorder={reorder}
        fields={[
          { name: 'name', label: L('contacts.name'), required: true, max: 100 },
          { name: 'relation', label: L('contacts.relation'), required: true, max: 50 },
          { name: 'phone', label: L('contacts.phone'), hint: L('contacts.phoneHint'), kind: 'phone' },
        ]}
        secondary={(i) => `${i.relation}, ${formatPhone(i.phone)}`} visible={vis.showContacts} onVisibility={(c) => setVisibility('showContacts', c)} onChanged={load}
      />
    </div>
  );
}
