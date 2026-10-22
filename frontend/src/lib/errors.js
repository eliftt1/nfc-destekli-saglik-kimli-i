/** API hatasını kullanıcının diline çevirir. Alan hataları (validation.*) formlarda ayrıca gösterilir. */
export function apiErrorText(t, err) {
  const code = err?.code ?? 'INTERNAL';
  return t(`errors.${code}`, { defaultValue: t('errors.INTERNAL') });
}
