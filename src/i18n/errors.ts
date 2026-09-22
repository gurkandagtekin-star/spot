import i18n from './i18n';
import EN from '../../shared/error-en.json';

export function acceptLanguage() {
  return String(i18n.language || '')
    .toLowerCase()
    .startsWith('tr')
    ? 'tr'
    : 'en';
}

export function localError(tr: string) {
  const text = String(tr || '');
  if (!text) return text;
  if (acceptLanguage() === 'tr') return text;
  return (EN as Record<string, string>)[text] || text;
}

export function failCatch(err: unknown, fallbackTr: string) {
  return err instanceof Error ? err.message : localError(fallbackTr);
}
