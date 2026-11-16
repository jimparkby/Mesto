/** Лимиты медиа в профиле — совпадают с ограничениями в БД и хранилище. */
export const MAX_PHOTOS = 9;
export const MAX_VIDEOS = 6;
export const MAX_VIDEO_MB = 50;

/**
 * Фото перед загрузкой: уменьшаем до 1600 px по длинной стороне и сохраняем в JPEG —
 * снимки с телефона весят по 5–10 МБ, а в профиле столько не нужно.
 */
export async function prepareImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    // HEIC и прочие форматы, которые браузер не декодирует, — загружаем как есть.
    return file;
  }
}

/** Маленькое превью (data URL) — для демо-режима без хранилища. */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('Не удалось прочитать файл'));
    r.readAsDataURL(file);
  });
}

export function isVideoUrl(url: string): boolean {
  return /^data:video\//.test(url) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}
