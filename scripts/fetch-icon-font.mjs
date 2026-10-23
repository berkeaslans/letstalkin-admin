// İkon fontu alt kümesini Google Fonts'tan BİR KEZ indirip kendi sunucumuzdan sunar
// (sayfa çizimi üçüncü taraf isteğini beklemez; ziyaretçinin IP'si Google'a gitmez).
// Boyut (opsz 24) ve derece (GRAD -25) sabit → dosya küçük; ağırlık ve dolgu değişken.
// icon-names.ts'e ikon eklenince yeniden çalıştırın:  npm run icons
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/components/ui/icon-names.ts', import.meta.url), 'utf8');
const list = src.slice(src.indexOf('['), src.indexOf('] as const'));
const names = [...new Set([...list.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]))].sort();

const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300..600,0..1,-25&icon_names=${names.join(',')}&display=block`;
// woff2 dönmesi için modern tarayıcı kimliği gerekir.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const css = await (await fetch(url, { headers: { 'user-agent': UA } })).text();
const fontUrl = css.match(/url\((https:[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) throw new Error(`woff2 bulunamadı:\n${css.slice(0, 400)}`);
const buf = Buffer.from(await (await fetch(fontUrl)).arrayBuffer());
writeFileSync(new URL('../public/fonts/material-symbols-rounded.woff2', import.meta.url), buf);
console.log(`${names.length} ikon, ${(buf.length / 1024).toFixed(1)} KB → public/fonts/material-symbols-rounded.woff2`);
