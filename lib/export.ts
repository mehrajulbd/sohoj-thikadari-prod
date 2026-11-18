export type Cell = unknown;
interface ExportOptions {
  subtitle?: string;
  total?: string;
  legal?: boolean;
  signature?: boolean;
}
const safe = (v: unknown) => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const s = v == null ? '' : String(v);
  return /^[=+@\-\t\r]/.test(s) ? "'" + s : s;
};
const filename = (title: string) => title.replace(/[<>:"/\\|?*]/g, '-').slice(0, 90) || 'report';
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
export async function exportRows(
  format: 'pdf' | 'csv' | 'xlsx',
  title: string,
  headers: string[],
  rows: Cell[][],
  options: ExportOptions = {},
) {
  if (format === 'csv') {
    const quote = (v: unknown) => '"' + safe(v).replace(/"/g, '""') + '"';
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(quote).join(',')).join('\r\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename(title) + '.csv');
    return;
  }
  if (format === 'xlsx') {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sohoz Thikadari';
    const ws = wb.addWorksheet('Report');
    ws.addRow([title]);
    if (options.subtitle) ws.addRow([options.subtitle]);
    ws.addRow(headers);
    for (const row of rows) {
      const added = ws.addRow(
        row.map((v, i) => {
          if (typeof v === 'number') return v;
          if (
            typeof v === 'string' &&
            /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) &&
            /date|তারিখ|created|updated/i.test(headers[i] || '')
          )
            return new Date(v.length === 10 ? v + 'T12:00:00Z' : v);
          return safe(v);
        }),
      );
      added.eachCell((cell, i) => {
        if (cell.value instanceof Date) cell.numFmt = 'yyyy-mm-dd';
        else if (
          typeof cell.value === 'number' &&
          /amount|cost|profit|balance|money|tax|পরিমাণ|খরচ|টাকা|আয়কর|জের|ফলাফল/i.test(
            headers[i - 1] || '',
          )
        )
          cell.numFmt = '#,##0.00';
      });
    }
    ws.views = [{ state: 'frozen', ySplit: options.subtitle ? 3 : 2 }];
    ws.columns = headers.map((h) => ({ width: Math.max(16, Math.min(36, h.length * 1.5)) }));
    ws.eachRow((row) => {
      row.font = { name: 'Noto Sans Bengali', size: 12 };
      row.alignment = { vertical: 'top', wrapText: true };
    });
    if (options.total) ws.addRow(['Total', options.total]);
    const bytes = await wb.xlsx.writeBuffer();
    download(
      new Blob([bytes as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename(title) + '.xlsx',
    );
    return;
  }
  const [pdfModule, response] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    fetch('/fonts/NotoSansBengali.ttf'),
  ]);
  if (!response.ok) throw new Error('The Bangla PDF font is unavailable. Reconnect and try again.');
  const buffer = new Uint8Array(await response.arrayBuffer());
  let raw = '';
  for (let i = 0; i < buffer.length; i += 8192)
    raw += String.fromCharCode(...buffer.subarray(i, i + 8192));
  const pdf = pdfModule.default;
  pdf.addVirtualFileSystem({ 'NotoSansBengali.ttf': btoa(raw) });
  pdf.addFonts({
    Noto: {
      normal: 'NotoSansBengali.ttf',
      bold: 'NotoSansBengali.ttf',
      italics: 'NotoSansBengali.ttf',
      bolditalics: 'NotoSansBengali.ttf',
    },
  });
  const columns = headers.length;
  const body = [
    headers.map((h) => ({ text: h, bold: true, fillColor: '#EAF3EE', color: '#174D37' })),
    ...rows.map((r) =>
      r.map((v, i) => ({
        text:
          v == null
            ? ''
            : typeof v === 'number' &&
                /amount|cost|profit|balance|money|tax|টাকার|খরচ|টাকা|আয়কর|জের|ফলাফল/i.test(
                  headers[i] || '',
                )
              ? v.toFixed(2)
              : String(v),
      })),
    ),
  ];
  const doc = {
    pageSize: options.legal ? 'LEGAL' : 'A4',
    pageOrientation: columns > 6 ? 'landscape' : 'portrait',
    pageMargins: [28, 30, 28, 35],
    defaultStyle: {
      font: 'Noto',
      fontSize: columns > 12 ? 8 : 10,
      lineHeight: 1.25,
      color: '#172B24',
    },
    content: [
      {
        text: options.subtitle?.split('\n')[0] || 'সহজ ঠিকাদারি',
        fontSize: 19,
        bold: true,
        margin: [0, 0, 0, 6],
      },
      { text: title, fontSize: 15, bold: true, margin: [0, 0, 0, 5] },
      ...(options.subtitle
        ? [
            {
              text: options.subtitle.split('\n').slice(1).join('\n'),
              fontSize: 10,
              margin: [0, 0, 0, 15],
            },
          ]
        : []),
      {
        table: { headerRows: 1, widths: Array(columns).fill('*'), body },
        layout: {
          hLineColor: () => '#CBD9D0',
          vLineColor: () => '#CBD9D0',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
      ...(options.total
        ? [
            {
              text: options.total,
              fontSize: 13,
              bold: true,
              alignment: 'right',
              margin: [0, 12, 0, 0],
            },
          ]
        : []),
      ...(options.signature
        ? [
            { text: '__________________________', alignment: 'right', margin: [0, 45, 0, 3] },
            { text: 'ঠিকাদারের স্বাক্ষর / Contractor signature', alignment: 'right', fontSize: 9 },
          ]
        : []),
    ],
    footer: (page: number, count: number) => ({
      text: `সহজ ঠিকাদারি    ${page} / ${count}`,
      alignment: 'center',
      fontSize: 9,
      color: '#52635C',
    }),
  };
  await pdf.createPdf(doc as never).download(filename(title) + '.pdf');
}
