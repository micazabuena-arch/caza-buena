/** Client-side CSV download helpers */

function csvCell(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(headers, rows) {
  const headerLine = headers.map((h) => csvCell(h.label)).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => csvCell(typeof h.value === 'function' ? h.value(row) : row[h.key])).join(',')
  );
  return `\uFEFF${[headerLine, ...dataLines].join('\n')}`;
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isPastStay(booking) {
  const out = String(booking.check_out || '').slice(0, 10);
  return out && out < todayYmd();
}
