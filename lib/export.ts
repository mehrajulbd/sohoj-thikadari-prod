import { createPdfText } from './pdf-text';

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
  if (!columns) throw new Error('A PDF report must have at least one column.');
  const landscape = columns > 6;
  const pageWidth = options.legal ? (landscape ? 1008 : 612) : landscape ? 841.89 : 595.28;
  const contentWidth = pageWidth - 56;
  const padding = columns > 12 ? 3 : 5;
  // Explicit widths prevent pdfmake's minimum word widths from expanding the table off-page.
  const weights = headers.map((header) =>
    /center|centre|কেন্দ্র/u.test(header)
      ? 1.65
      : /invoice|truck|number|no\.|নম্বর|প্রোগ্রাম$/iu.test(header)
        ? 1.25
        : /date|তারিখ/iu.test(header)
          ? 1.1
          : 0.85,
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const available = contentWidth - columns * padding * 2 - (columns + 1) * 0.5;
  const widths = weights.map((weight) => (available * weight) / weightTotal);
  const fontSize = columns > 12 ? 8.5 : 10;
  const shaped = await createPdfText(buffer.buffer);
  try {
    const body = [
      headers.map((h, i) => ({
        ...shaped.text(h, widths[i], fontSize, true, '#174D37'),
        fillColor: '#EAF3EE',
      })),
      ...rows.map((r) =>
        headers.map((header, i) => {
          const value = r[i];
          const valueText =
            value == null
              ? ''
              : typeof value === 'number' &&
                  /amount|cost|profit|balance|money|tax|টাকার|খরচ|টাকা|আয়কর|জের|ফলাফল/iu.test(
                    header,
                  )
                ? value.toFixed(2)
                : String(value);
          const subtotal = /^(Program subtotal|প্রোগ্রামের মোট)$/u.test(String(r[0]));
          return {
            ...shaped.text(valueText, widths[i], fontSize, subtotal),
            alignment: typeof value === 'number' ? 'right' : 'left',
            ...(subtotal ? { fillColor: '#EAF3EE' } : {}),
          };
        }),
      ),
    ];
    const footerTitle = shaped.text(title, contentWidth - 150, 8, false, '#52635C');
    const doc = {
      pageSize: options.legal ? 'LEGAL' : 'A4',
      pageOrientation: landscape ? 'landscape' : 'portrait',
      pageMargins: [28, 30, 28, 35],
      images: shaped.images,
      defaultStyle: { font: 'Noto', fontSize, lineHeight: 1.3, color: '#172B24' },
      content: [
        {
          ...shaped.text(
            options.subtitle?.split('\n')[0] || 'সহজ ঠিকাদারি',
            contentWidth,
            18,
            true,
          ),
          margin: [0, 0, 0, 3],
        },
        { ...shaped.text(title, contentWidth, 14, true), margin: [0, 0, 0, 6] },
        ...(options.subtitle?.includes('\n')
          ? [
              {
                ...shaped.text(options.subtitle.split('\n').slice(1).join('\n'), contentWidth, 10),
                margin: [0, 0, 0, 12],
              },
            ]
          : []),
        {
          table: { headerRows: 1, keepWithHeaderRows: 1, widths, body },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#CBD9D0',
            vLineColor: () => '#CBD9D0',
            fillColor: (row: number) => (row > 0 && row % 2 === 0 ? '#F7FAF8' : null),
            paddingLeft: () => padding,
            paddingRight: () => padding,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
        ...(options.total
          ? [
              {
                ...shaped.text(
                  `${/[\u0980-\u09ff]/u.test(title) ? 'সর্বমোট' : 'Grand total'}: ${options.total}`,
                  Math.min(300, contentWidth),
                  13,
                  true,
                  '#172B24',
                  'right',
                ),
                alignment: 'right',
                margin: [0, 12, 0, 0],
              },
            ]
          : []),
        ...(options.signature
          ? [
              {
                unbreakable: true,
                stack: [
                  { text: '__________________________', alignment: 'right', margin: [0, 35, 0, 5] },
                  {
                    ...shaped.text(
                      'ঠিকাদারের স্বাক্ষর / Contractor signature',
                      230,
                      9,
                      false,
                      '#172B24',
                      'right',
                    ),
                    alignment: 'right',
                  },
                ],
              },
            ]
          : []),
      ],
      footer: (page: number, count: number) => ({
        columns: [
          { ...footerTitle, width: contentWidth - 150 },
          { text: `Sohoz Thikadari  |  ${page} / ${count}`, alignment: 'right', width: 150 },
        ],
        fontSize: 8,
        color: '#52635C',
        margin: [28, 8, 28, 0],
      }),
    };
    await pdf.createPdf(doc as never).download(filename(title) + '.pdf');
  } finally {
    shaped.dispose();
  }
}
