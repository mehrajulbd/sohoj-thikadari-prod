/** Browser shaping preserves Bengali conjuncts that the PDF text engine mispositions. */
export async function createPdfText(font: ArrayBuffer) {
  const face = new FontFace('Export Bengali', font, {
    weight: '100 900',
  });
  document.fonts.add(await face.load());
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF text rendering is unavailable in this browser.');
  const images: Record<string, string> = {};
  const cache = new Map<string, string>();
  const segmenter = new Intl.Segmenter('bn', { granularity: 'grapheme' });
  const text = (
    value: string,
    width: number,
    size: number,
    bold = false,
    color = '#172B24',
    alignment: 'left' | 'right' = 'left',
  ) => {
    if (!/[\u0980-\u09ff]/u.test(value))
      return { text: value, fontSize: size, bold, color, alignment };
    const key = JSON.stringify([value, width, size, bold, color, alignment]);
    const existing = cache.get(key);
    if (existing) return { image: existing, width };
    const font = `${bold ? 700 : 400} ${size}px "Export Bengali"`;
    context.font = font;
    const lines: string[] = [];
    // Wrap at words first, then at graphemes for long references. Never split a conjunct.
    for (const paragraph of value.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/(\s+)/u)) {
        if (context.measureText(line + word).width <= width) {
          line += word;
          continue;
        }
        if (line.trim()) lines.push(line.trimEnd());
        line = '';
        for (const { segment } of segmenter.segment(word.trimStart())) {
          if (line && context.measureText(line + segment).width > width) {
            lines.push(line);
            line = '';
          }
          line += segment;
        }
      }
      lines.push(line.trimEnd());
    }
    const lineHeight = size * 1.65;
    const height = lines.length * lineHeight + size * 0.25;
    // Four pixels per PDF point gives sharp glyphs even on printed copies.
    const scale = 4;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    context.scale(scale, scale);
    context.font = font;
    context.fillStyle = color;
    context.textBaseline = 'alphabetic';
    context.textAlign = alignment;
    lines.forEach((line, i) =>
      context.fillText(line, alignment === 'right' ? width : 0, size * 1.2 + i * lineHeight),
    );
    const id = `bengali${cache.size}`;
    images[id] = canvas.toDataURL('image/png');
    cache.set(key, id);
    return { image: id, width };
  };
  return { text, images, dispose: () => document.fonts.delete(face) };
}
