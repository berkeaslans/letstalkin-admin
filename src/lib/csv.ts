// CSV dışa aktarma. Excel ve Numbers Türkçe karakterleri doğru okusun diye
// UTF-8 BOM ile; noktalı virgül ayracı Türkçe Excel'in beklediği biçim.
const SEP = ';';

function cell(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleString('tr-TR');
  const s = String(v);
  // Alanın içinde ayraç, tırnak ya da satır sonu varsa tırnakla.
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Satırları CSV'ye çevirip indirir. `columns` sırayı ve başlıkları belirler. */
export function downloadCsv<T>(filename: string, rows: T[], columns: Array<{ header: string; value: (row: T) => unknown }>): void {
  const head = columns.map((c) => cell(c.header)).join(SEP);
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(SEP));
  const blob = new Blob([`﻿${[head, ...body].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sayfalı bir uçtan en fazla `max` satır toplar (dışa aktarma için). */
export async function collectAll<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  max = 5000,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && out.length < max);
  return out.slice(0, max);
}
