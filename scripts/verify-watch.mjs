// Verify candidate YouTube IDs via the public oEmbed endpoint — confirms each video EXISTS and is
// EMBEDDABLE, and returns its canonical title + channel. $0, no API key. Run before hard-coding any
// ID into the Watch feature (a dead/non-embeddable embed in a religious app is unacceptable).
//   node scripts/verify-watch.mjs

const IDS = [
  // --- Seerah ---
  'UXvuza99T4s', 'PH61HNWHCyU', 'lYibnBoD6fk', // ch1
  'kzIu3hrdqRM', 'Vdug1pNex54', 'lNP_QsSQkoA', // ch2
  '6M-NQKRdNuM', 'xUqhH8gHdJw', 'AMLf4LfE_AM', // ch3
  'ntv3dJv8wqQ', 'qMmn1Lqh95M', 'butrsoKNPz4', 'dvYzs6aDSfM', // ch4
  'YlVt1to1z5Y', 'd7xmC2qpG_o', 'f59ktgGYw_w', 'hYndbxSMM6g', // ch5
  'KrzPe8NrRd4', 'qWubL2TGPlc', 'eBJBztVbOZQ', 'ZBff8J75s7c', 'xmTpqOjSgDA', // ch6
  'cRmeK1tKuiY', // ch7
  'OTwmuzD-n2w', 'dsQkLDtVy4Q', 'SNmETUE2GFA', '3Tfnt-DafPM', 'laEQTyDFs-A', 'BJBjWZRQD98', // ch8
  'TsjC5a7AwYU', 'SfztkWQPXz0', // ch9
  'Ie8ebDeH7ck', 'iGVnSOXG4cI', 'Okf-V5RyKdY', // ch10
  // --- History ---
  'Rck2DlxxkTc', 'x0f_VO0Weu4', 'o9bx7Zw4PZ0', 'In91yLh_WFU', // era1 caliphs
  'fc7-Ja26AqQ', '4UApaTBbGVk', // era2 umayyads
  'O8hhwSn1iaU', 'LnVl9AsoraE', 'c8HlFFDTBWQ', // era3 abbasids
  'zHhDoNDyjHA', 'yA6dm7CCSDA', 'iHAcvlkeUZE', // era4 andalus
  '3cVfyurIFvM', 'faQmHzY29Zc', 'uFAFZbrrCjA', // era5 sciences
  'uxnT1Trn5kc', 'BlY5P6J3Zs8', 'b7FIuZeqdEQ', // era6 ottomans
  // --- gap-fill additions ---
  'fH49JET37eY', 'FwbSkCofNA4', // seerah: badr, hudaybiyyah
  'sAxWF_W6Q9w', '-3MPE2BWmBo', 'kHTLBHt3zUM', 'j6hiITWBXpQ', // history: algebra, baghdad, saladin, granada
];

async function check(id) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`;
  try {
    const res = await fetch(url);
    if (res.status !== 200) return { id, ok: false, status: res.status };
    const j = await res.json();
    return { id, ok: true, title: j.title, author: j.author_name };
  } catch (e) {
    return { id, ok: false, error: String((e && e.message) || e) };
  }
}

const results = [];
for (const id of IDS) {
  const r = await check(id);
  results.push(r);
  console.log(
    r.ok
      ? `OK  ${id}  [${r.author}]  ${r.title}`
      : `XX  ${id}  (${r.status || r.error})  not embeddable/found`,
  );
  await new Promise((res) => setTimeout(res, 150));
}
const bad = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - bad.length}/${results.length} embeddable.` +
    (bad.length ? ` Dead/blocked: ${bad.map((b) => b.id).join(', ')}` : ' All good.'),
);
