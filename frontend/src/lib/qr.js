import QRCode from 'qrcode';

/** Bağlantıyı içeren PNG (data URL) üretir. 4 modül sessiz bölge tarayıcıların güvenilir okuması için gereklidir. */
export const makeQrPng = (text) =>
  QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 4, width: 360, color: { dark: '#10243a', light: '#ffffff' } });

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
