import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { apiErrorText } from '../lib/errors.js';
import { checkOptional, checkPhone, checkRequired } from '../lib/validate.js';
import { Button, Card, ConfirmAction, TextField, VisibilityToggle } from './ui.jsx';
import { useToast } from './Toast.jsx';

const validateField = (f, v) => (f.kind === 'phone' ? checkPhone(v) : f.required ? checkRequired(v, f.max) : checkOptional(v, f.max));

function ItemForm({ fields, initial = {}, submitLabel, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ''])));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const errs = Object.fromEntries(fields.map((f) => [f.name, validateField(f, values[f.name])]).filter(([, v]) => v));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const serverErrors = await onSubmit(Object.fromEntries(fields.map((f) => [f.name, values[f.name].trim()])));
    setBusy(false);
    if (serverErrors) setErrors(serverErrors);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-lg bg-paper p-4">
      {fields.map((f) => (
        <TextField
          key={f.name}
          name={f.name}
          label={f.label}
          hint={f.hint}
          type={f.kind === 'phone' ? 'tel' : 'text'}
          autoComplete={f.kind === 'phone' ? 'off' : undefined}
          value={values[f.name]}
          error={errors[f.name]}
          onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}

/**
 * Alerji/hastalık/ilaç/kişi listeleri için ortak bölüm: ekle, düzenle, sil, (isteğe bağlı) sırala, göster/gizle.
 */
export default function ListSection({
  id, title, emptyText, items, fields, endpoint, max, addLabel,
  visible, onVisibility, onChanged, onReorder, orderHint, secondary,
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const headingId = `${id}-heading`;
  const full = items.length >= max;

  async function save(method, path, values, successKey) {
    try {
      await api(`/profile/${endpoint}${path}`, { method, body: values });
      toast.success(t(`profile.actions.${successKey}`));
      await onChanged();
      return null;
    } catch (err) {
      if (err.fields) return err.fields;
      toast.error(apiErrorText(t, err));
      return {};
    }
  }

  async function remove(item) {
    setBusyId(item.id);
    try {
      await api(`/profile/${endpoint}/${item.id}`, { method: 'DELETE' });
      toast.success(t('profile.actions.deleted'));
      await onChanged();
    } catch (err) {
      toast.error(apiErrorText(t, err));
    } finally {
      setBusyId(null);
    }
  }

  async function move(index, delta) {
    const ids = items.map((i) => i.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await onReorder(ids);
  }

  return (
    <Card>
      <section aria-labelledby={headingId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="text-xl font-bold">{title}</h2>
          <VisibilityToggle
            name={`${id}-visibility`}
            checked={visible}
            onChange={onVisibility}
            label={t('profile.visibility.label')}
          />
        </div>
        {orderHint && items.length > 1 && <p className="mt-1 text-sm text-slate">{orderHint}</p>}

        {items.length === 0 ? (
          <p className="mt-3 rounded-lg bg-paper p-3 text-slate">{emptyText}</p>
        ) : (
          <ul className="mt-3">
            {items.map((item, index) => (
              <li key={item.id} className="border-t border-line py-3 first:border-t-0">
                {editingId === item.id ? (
                  <ItemForm
                    fields={fields}
                    initial={item}
                    submitLabel={t('profile.actions.saveItem')}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      const errs = await save('PUT', `/${item.id}`, values, 'updated');
                      if (!errs) setEditingId(null);
                      return errs;
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-lg font-bold">{item.name}</p>
                      {secondary(item) && <p className="break-words text-slate">{secondary(item)}</p>}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      {onReorder && (
                        <>
                          <Button variant="secondary" className="min-w-12 px-0" disabled={index === 0} aria-label={t('profile.lists.contacts.moveUp', { name: item.name })} onClick={() => move(index, -1)}>↑</Button>
                          <Button variant="secondary" className="min-w-12 px-0" disabled={index === items.length - 1} aria-label={t('profile.lists.contacts.moveDown', { name: item.name })} onClick={() => move(index, 1)}>↓</Button>
                        </>
                      )}
                      <Button variant="secondary" aria-label={`${t('profile.actions.edit')}: ${item.name}`} onClick={() => { setEditingId(item.id); setAdding(false); }}>
                        {t('profile.actions.edit')}
                      </Button>
                      <ConfirmAction
                        label={t('profile.actions.delete')}
                        ariaLabel={`${t('profile.actions.delete')}: ${item.name}`}
                        message={t('profile.actions.confirmDelete')}
                        confirmLabel={t('profile.actions.yesDelete')}
                        busy={busyId === item.id}
                        onConfirm={() => remove(item)}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          {adding ? (
            <ItemForm
              fields={fields}
              submitLabel={addLabel}
              onCancel={() => setAdding(false)}
              onSubmit={async (values) => {
                const errs = await save('POST', '', values, 'added');
                if (!errs) setAdding(false);
                return errs;
              }}
            />
          ) : full ? (
            <p className="text-sm font-bold text-slate">{t('profile.actions.limit', { count: max })}</p>
          ) : (
            <Button variant="secondary" onClick={() => { setAdding(true); setEditingId(null); }}>+ {addLabel}</Button>
          )}
        </div>
      </section>
    </Card>
  );
}
