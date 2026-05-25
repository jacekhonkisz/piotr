import fs from 'fs';
import path from 'path';

let cachedDataUrl: string | null = null;

/** Fixed brand logo for all PDF reports (Piotr Bajerlein Marketing). */
const RELATIVE_PUBLIC = path.join(process.cwd(), 'public', 'freepik_0001.png');

/**
 * Returns a data URL so Puppeteer `setContent` always resolves the image without HTTP.
 */
export function getPdfBrandLogoDataUrl(): string {
  if (cachedDataUrl) return cachedDataUrl;
  try {
    const buf = fs.readFileSync(RELATIVE_PUBLIC);
    cachedDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    return cachedDataUrl;
  } catch {
    return '';
  }
}
