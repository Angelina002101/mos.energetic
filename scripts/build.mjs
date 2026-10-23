import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const publicFiles = ['index.html', 'styles.css', 'app.js', 'privacy.html', 'consent.html', 'assets'];
const required = [...publicFiles, 'api/contact.js', 'assets/hero.webp', 'assets/substation.webp'];
for (const file of required) {
  try { await access(path.join(root, file)); }
  catch { throw new Error(`Не загружен файл или папка: ${file}. Загрузите весь комплект с сохранением папок.`); }
}
const api = await readFile(path.join(root, 'api/contact.js'), 'utf8');
if (!api.includes('export default async function handler')) throw new Error('Некорректный обработчик api/contact.js');
const output = path.join(root, 'public');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of publicFiles) await cp(path.join(root,file), path.join(output,file), { recursive: true });
console.log('Готово: публичные файлы собраны в public/. Серверная функция: api/contact.js.');
