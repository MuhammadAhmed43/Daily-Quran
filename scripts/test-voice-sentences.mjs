// Mirrors pullSentences() in mobile/lib/voice-reply.ts (project convention: a test mirrors the
// engine it checks). Verifies the streaming sentence splitter that drives the low-latency voice
// reply: complete sentences are peeled IN ORDER, an abbreviation ("e.g."/"i.e.") or an ayah ref
// "(11:11)." is never split, and nothing is emitted before it is actually complete.
//
// Run: node scripts/test-voice-sentences.mjs

const SENTENCE_RE = /^([\s\S]*?[.!?]+["'”’)\]]*)\s+(?=[A-Z0-9"'“‘(])([\s\S]*)$/;

function pullSentences(buf, finalize) {
  const sentences = [];
  let rest = buf;
  for (;;) {
    const m = rest.match(SENTENCE_RE);
    if (!m) break;
    const s = m[1].trim();
    rest = m[2];
    if (s) sentences.push(s);
  }
  if (finalize) {
    const tail = rest.trim();
    if (tail) {
      sentences.push(tail);
      rest = '';
    }
  }
  return { sentences, rest };
}

// Simulate the producer feeding chat tokens a few chars at a time: append, pull(false) each step,
// pull(true) once the stream ends. Returns every emitted sentence, in order.
function simulateStream(text, chunkSize = 3) {
  let answer = '';
  let consumed = 0;
  const out = [];
  const step = (finalize) => {
    const { sentences, rest } = pullSentences(answer.slice(consumed), finalize);
    consumed = answer.length - rest.length;
    out.push(...sentences);
  };
  for (let i = 0; i < text.length; i += chunkSize) {
    answer += text.slice(i, i + chunkSize);
    step(false);
  }
  step(true);
  return out;
}

let pass = 0;
let fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL  ${label}\n  expected ${e}\n  actual   ${a}`);
  }
}

// 1) a complete leading sentence is peeled; the next (not yet followed) waits in `rest`
eq(pullSentences('Hello there. How are you?', false).sentences, ['Hello there.'], 'split-1');
eq(pullSentences('Hello there. How are you?', false).rest, 'How are you?', 'rest-1');

// 2) finalize flushes the trailing sentence
eq(pullSentences('How are you?', true).sentences, ['How are you?'], 'finalize-1');

// 3) an ayah reference stays glued to its sentence; the next splits on the capital
eq(
  pullSentences('Be patient (11:11). May Allah ease it.', true).sentences,
  ['Be patient (11:11).', 'May Allah ease it.'],
  'ayah-ref',
);
eq(
  pullSentences('Trust the promise (2:155-157). Hold on.', true).sentences,
  ['Trust the promise (2:155-157).', 'Hold on.'],
  'ayah-ref-range',
);

// 4) abbreviations must NOT split (the char after the period is lowercase)
eq(
  pullSentences('See e.g. the verse. It helps.', true).sentences,
  ['See e.g. the verse.', 'It helps.'],
  'abbrev-eg',
);
eq(
  pullSentences('That is i.e. the point. Reflect.', true).sentences,
  ['That is i.e. the point.', 'Reflect.'],
  'abbrev-ie',
);

// 5) a colon inside a ref (2:255) is never a terminator
eq(
  pullSentences('Read 2:255 now. Reflect on it.', true).sentences,
  ['Read 2:255 now.', 'Reflect on it.'],
  'ref-colon',
);

// 6) streaming a few chars at a time never loses or reorders content
for (const text of [
  'In Surah Hud, verse 11, the Quran promises reward for the patient (11:11). May Allah help you. Stay close to Him.',
  'Yes. Prayer brings peace. Turn to Him often!',
  'A single sentence with no following one',
  'Patience is hard. But Allah is with the patient (2:153).',
]) {
  for (const chunk of [1, 3, 7]) {
    const emitted = simulateStream(text, chunk);
    const joined = emitted.join(' ').replace(/\s+/g, ' ').trim();
    const norm = text.replace(/\s+/g, ' ').trim();
    eq(joined, norm, `stream-roundtrip[chunk=${chunk}]: ${text.slice(0, 22)}...`);
  }
}

// 7) an unterminated tail is NEVER emitted while streaming
eq(pullSentences('This is incomplete', false).sentences, [], 'no-premature');
eq(pullSentences('This is incomplete', false).rest, 'This is incomplete', 'rest-incomplete');

// 8) a terminator at the very end of the buffer waits for the next char (or finalize)
eq(pullSentences('Done.', false).sentences, [], 'wait-for-next-char');
eq(pullSentences('Done. ', false).sentences, [], 'wait-trailing-space-only');
eq(pullSentences('Done. Next', false).sentences, ['Done.'], 'split-when-next-arrives');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
