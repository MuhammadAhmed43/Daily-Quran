// Minimal, dependency-free Markdown handling for the chat answer. The model occasionally emits
// headings, tables, or lists; we parse them into simple block descriptors that chat.tsx renders as
// real UI (a styled heading, a clean table grid, bullets) instead of leaking raw "###" / "| a | b |"
// markers. mdToPlain() is the lighter pass the streaming typewriter uses so the live reveal stays
// clean too (it strips markers to plain text rather than rendering structure).

export type MdBlock =
  | { type: 'heading'; text: string }
  | { type: 'bullet'; text: string; marker: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'rule' }
  | { type: 'para'; text: string };

const hasPipe = (t: string) => t.includes('|');
const isTableRow = (t: string) => hasPipe(t) && /[^\s|]/.test(t);
const isSepRow = (t: string) => hasPipe(t) && t.includes('-') && /^[\s|:-]+$/.test(t);
const splitCells = (t: string) =>
  t
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

export function parseMarkdownBlocks(text: string): MdBlock[] {
  const lines = text.replace(/\r/g, '').replace(/```+/g, '').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) {
      i++;
      continue;
    }

    // Table: only when the next line is ALSO a table row (so a lone "|" in prose isn't a table).
    if (isTableRow(t) && isTableRow((lines[i + 1] ?? '').trim())) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const lt = lines[i].trim();
        if (!isSepRow(lt)) rows.push(splitCells(lt));
        i++;
      }
      if (rows.length >= 2) {
        blocks.push({ type: 'table', rows });
      } else if (rows.length === 1) {
        blocks.push({ type: 'para', text: rows[0].join('  ·  ') }); // a stray single row — don't show pipes
      }
      continue;
    }

    const h = t.match(/^#{1,6}\s*(.+)$/);
    if (h) {
      blocks.push({ type: 'heading', text: h[1].trim() });
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    const b = t.match(/^[-*+]\s+(.+)$/);
    if (b) {
      blocks.push({ type: 'bullet', text: b[1].trim(), marker: '•' });
      i++;
      continue;
    }
    const n = t.match(/^(\d+)[.)]\s+(.+)$/);
    if (n) {
      blocks.push({ type: 'bullet', text: n[2].trim(), marker: `${n[1]}.` });
      i++;
      continue;
    }

    const q = t.match(/^>\s?(.*)$/);
    blocks.push({ type: 'para', text: q ? q[1] : t });
    i++;
  }
  return blocks;
}

// Strip Markdown to clean plain text for the streaming reveal — no raw "###", "|", or "*" leaking
// while the answer types out. The finished answer is rendered structurally by parseMarkdownBlocks.
export function mdToPlain(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/```+/g, '')
    .split('\n')
    .map((line) => {
      if (isSepRow(line.trim())) return ''; // table separator row
      let s = line.replace(/^\s*#{1,6}\s*/, '').replace(/^\s*>\s?/, '');
      s = s.replace(/^(\s*)[-*+]\s+/, '$1•  ').replace(/^(\s*)(\d+)[.)]\s+/, '$1$2.  ');
      s = s.replace(/\s*\|\s*/g, '   '); // table pipes → spaces
      return s;
    })
    .join('\n')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1');
}
