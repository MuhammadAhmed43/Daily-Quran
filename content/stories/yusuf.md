# Storyboard — Surah Yusuf (12) · "The Most Beautiful Story"

Draft panel script for the **Stories** tab. Surah Yusuf is the Qur'an's most complete
single-surah narrative (111 ayahs) and is unusually rich in *non-figurative* symbols,
which makes it the ideal first story for a **fully aniconic** storyboard.

## Design system

**Render rules (carry the app's guarantees into Stories):**
- **Verse text renders from the verified DB by reference** — never typed by hand, never
  LLM-generated. The "ON SCREEN" line in each panel is the exact Itani text from
  `mobile/assets/quran/quran.json` (shown here for review).
- **Narration is app-authored retelling**, visually distinct from scripture (different
  type/weight), and stays faithful to the Qur'anic account — no Israiliyyat, no invented
  detail. Third-person narrator only; **never voice or depict a prophet.**
- **Art style — aniconic manga, in color.** Manga's full visual toolkit — bold linework,
  screentone-style shading, dramatic paneling, dynamic "camera" angles, emotional
  light/weather, speed lines — in a warm color palette (see color arc). Generated, then
  **human-reviewed per panel**; never on-the-fly at runtime.
- **Who can appear, and how.** **Prophets (Yusuf, Yaʿqub, peace be upon them) are NEVER
  depicted — not even as a silhouette** (Tier-1; the Majidi precedent condemns even a
  faceless form). They are present through their *objects, the shirt, the throne, light, and
  a reverent empty space.* **Ordinary people** (the brothers, the women, the king, the
  inmates, the caravan) appear only as **soft, unstructured white silhouettes** — luminous
  presences with no faces, no anatomy, no detail. Everything else is **objects, architecture,
  nature, calligraphy, and Islamic geometry.** The contrast is intentional: you can feel who
  is a prophet by the reverent absence.
- **Honorific:** prophets' names in narration carry **(peace be upon him)** on first mention per panel. *(ﷺ is reserved for the Prophet Muhammad; other prophets — Yusuf, Yaʿqub — take "peace be upon him," ʿalayhi as-salām.)*
- **Narration audio (v1, included):** pre-generated **third-person** narration with **Kokoro-82M** (Apache-2.0, free), **Piper** (CPU) fallback; MP3s cached in Supabase Storage / bundled. **Never voice-act a prophet** — the audio twin of the aniconism rule.

**Recurring visual motifs (the spine that makes it feel composed, not a slideshow):**
- **The Shirt (qamīṣ)** — the sura's own thread: *stained* (P5) → *torn from behind* (P7)
  → *luminous, restoring sight* (P15). It carries grief to restoration.
- **The Celestial dream** — eleven stars + sun + moon: *foretold* (P2) → *fulfilled* (P16).
- **The Geometric pattern** — *fractured* in jealousy (P3) → made *whole and gold* (P12) →
  *complete and luminous* (P16).
- **Vertical motion** — *descent* into the well (P4) and prison (P9) → *ascent* over the
  storehouses and throne (P12, P16).
- **Color arc** — cold indigo & night (separation, the well) → warm gold (Egypt, grain,
  reunion). The palette itself tells the redemption.

> Aniconic note for the king's dream (P11): the verse mentions cows, but **cows are animate**,
> so the *image* renders the dream through its **grain** half (seven green vs. withered spikes)
> and stylized numerals — the cows live only in the verse/narration text. This is a deliberate,
> defensible aniconic choice.

---

## Panels

> The app's canonical, enriched narration + each scene's "camera move" live in
> `mobile/assets/stories/yusuf.json`. The entries below show the art direction (still
> accurate) and a concise narration; the shipped app uses a longer, more connective
> retelling of each scene so the story reads cleanly swipe-to-swipe.

### P1 — The Most Beautiful Story
- **Verse:** 12:3
- **ON SCREEN:** *"We narrate to you the most accurate history, by revealing to you this Quran. Although, prior to it, you were of the unaware."*
- **Narration:** The Qur'an calls this *aḥsan al-qaṣaṣ* — the most beautiful of stories. It begins with a boy, a dream, and a father who understood.
- **Visual:** Title panel. The word **سُورَةُ يُوسُف** in calligraphy over a slowly-rotating eight-point Islamic star pattern (girih), indigo deepening to gold. *Motif: geometry (whole — we'll fracture and heal it across the story).*

### P2 — The Dream
- **Verse:** 12:4  *(caution: 12:5)*
- **ON SCREEN:** *"O my father, I saw eleven planets, and the sun, and the moon; I saw them bowing down to me."*
- **Narration:** Young Yusuf (peace be upon him) told his father, Yaʿqub (peace be upon him), of a dream: eleven stars, the sun, and the moon, bowing toward him. His father warned him to keep it close — *"do not relate your vision to your brothers."*
- **Visual:** A deep night sky; **eleven stars, a sun, and a moon** arranged in a circle, each gently inclined toward a single point of light at the center. No figures — the heavens do the bowing. *Motif: celestial (the promise).*

### P3 — Jealousy and the Plot
- **Verse:** 12:8–9
- **ON SCREEN:** *"Joseph and his brother are dearer to our father than we are, although we are a whole group."*
- **Narration:** His brothers' envy hardened into a plan — to remove Yusuf (peace be upon him) and have their father's love to themselves.
- **Visual:** A flawless geometric tile pattern beginning to **crack and pull apart**, one bright tile isolated as the others turn cold and grey; **white silhouette forms (the brothers)** cluster in the shadow, conspiring, turned away from the bright tile. *Motif: geometry (fractured); first white-silhouette crowd.*

### P4 — Into the Well
- **Verse:** 12:10, 15
- **ON SCREEN:** *"And We inspired him, 'You will inform them of this deed of theirs when they are unaware.'"*
- **Narration:** Instead of the worst, one brother urged the well. They lowered him in — and in that darkness came a quiet promise that one day he would tell them of this, and they would not know him.
- **Visual:** Looking **up from the bottom of a stone well** — a small bright circle of sky far above, a rope still swaying. A faint warm glow rests at the base: he is not alone. *Motif: vertical descent.*

### P5 — The Shirt, and "Patience is Beautiful"
- **Verse:** 12:18
- **ON SCREEN:** *"…But patience is beautiful, and God is my Help against what you describe."*
- **Narration:** They returned with his shirt and a false story. Yaʿqub (peace be upon him) saw through it, and answered grief not with rage but with *ṣabrun jamīl* — a beautiful patience.
- **Visual:** A folded **garment laid on sand**, a dark stain at its edge; above it, *"patience is beautiful"* in gold calligraphy. *Motif: the Shirt (stained) — first appearance.*

### P6 — Sold into Egypt
- **Verse:** 12:19, 21
- **ON SCREEN:** *"Take good care of him; he may be useful to us, or we may adopt him as a son."*
- **Narration:** A passing caravan drew him up like water from a well and carried him to Egypt, where the man who bought him told his household to honor him. What looked like loss was a door opening.
- **Visual:** A **bronze water-bucket and a scatter of coins** on stone; beyond, the silhouette of an Egyptian palace gate at dusk — the first warm gold. *Motif: color turn (night → gold), descent→arrival.*

### P7 — Integrity, and the Torn Shirt
- **Verse:** 12:23, 26–28
- **ON SCREEN:** *"God forbid! He is my Lord. He has given me a good home. Sinners never succeed."*
- **Narration:** Years later, tempted and cornered, he refused — *"God forbid."* The truth was proven by the shirt itself: torn from behind, it spoke for him when he could not.
- **Visual:** Carved **mashrabiya doors, bolted**, light slicing through the lattice; the garment motif returns, **torn at the back hem**, beside a small set of **scales tipping toward truth**. *Motif: the Shirt (torn) — second appearance.*

### P8 — The Banquet of Knives
- **Verse:** 12:31
- **ON SCREEN:** *"And when they saw him, they marveled at him, and cut their hands."*
- **Narration:** The women who mocked her were each given a knife and a fruit — and were so struck they forgot the blades in their own hands. The whole scene, told without a single face.
- **Visual:** A patterned cloth set with **citrons and small knives**, one bead of red at a blade's edge; around the table, **white silhouette forms (the women)** freeze mid-gesture, hands raised in awe. Yusuf (peace be upon him) is *not* shown — we see only their reaction. *Objects + silhouetted awe carry a scene with no face in it.*

### P9 — "Prison is Dearer to Me"
- **Verse:** 12:33, 35
- **ON SCREEN:** *"My Lord, prison is more desirable to me than what they call me to."*
- **Narration:** Falsely accused, he chose a cell over a sin. He would rather lose his freedom than his integrity.
- **Visual:** A **barred window** throwing striped shadow across a bare stone floor, a single shaft of light. Dignity in confinement. *Motif: vertical descent (again — the low point before the rise).*

### P10 — The One God in Prison
- **Verse:** 12:37–40
- **ON SCREEN:** *"O My fellow inmates, are diverse lords better, or God, the One, the Supreme?"*
- **Narration:** To two fellow prisoners puzzled by their dreams, he first spoke of the One God — then read their dreams true. Faith before favor.
- **Visual:** Darkness with **one rising point of light** outshining a row of small, empty idol-niches; faint imagery of a cup and a loaf (the two dreams) at the margins. *Motif: monotheism as a single light.*

### P11 — The King's Dream, and the Plan
- **Verse:** 12:43, 47–48
- **ON SCREEN:** *"…seven green spikes, and others dried up. O elders, explain to me my vision…"*
- **Narration:** The king dreamed of plenty devoured by famine. Yusuf (peace be upon him) read it and gave a plan: store the harvest of the good years to feed the hard ones to come.
- **Visual:** **Seven full, golden wheat-sheaves** beside **seven withered grey ones**; behind them, rows of sealed granary jars. (Cows kept to the verse text only — see aniconic note.) *Motif: grain; color split gold/grey.*

### P12 — Raised Over the Storehouses
- **Verse:** 12:55–56
- **ON SCREEN:** *"Put me in charge of the storehouses of the land; I am honest and knowledgeable."*
- **Narration:** From the prison to the treasury — the one cast into a well was entrusted with a nation's bread. *"We never waste the reward of the righteous."*
- **Visual:** Ranks of **sealed granary jars** and a single **iron key** in warm gold light; the fractured pattern of P3 now **reassembled and whole**. *Motif: geometry (healed); vertical ascent.*

### P13 — The Cup and the Brother
- **Verse:** 12:69–70
- **ON SCREEN:** *"I am your brother; do not be saddened by what they used to do."*
- **Narration:** When his brothers came for grain, he kept his youngest brother close by a quiet device — a king's cup hidden in a saddlebag — so they would return again.
- **Visual:** A **golden goblet** nestled in a woven **saddlebag** among sacks of grain. A secret kindness, not a theft. *Motif: grain + gold; reunion beginning.*

### P14 — "No Blame Upon You Today"
- **Verse:** 12:90, 92
- **ON SCREEN:** *"There is no blame upon you today. God will forgive you. He is the Most Merciful of the merciful."*
- **Narration:** At last he revealed himself to the brothers who had wronged him. Holding every right to punish, he chose forgiveness — *lā tathrība ʿalaykum al-yawm.*
- **Visual:** A **gate swinging open** with light flooding through; the words *"no blame upon you today"* in calligraphy; **white silhouettes of the brothers** bow low in the doorway's glow. Yusuf (peace be upon him) *is* the flooding light — never a figure. Forgiveness rendered as an opening. *Motif: light; the turn home.*

### P15 — The Shirt Restores Sight
- **Verse:** 12:93, 96
- **ON SCREEN:** *"Take this shirt of mine, and lay it over my father's face, and he will recover his sight."*
- **Narration:** He sent his shirt ahead. Laid over his grieving father's face, it returned his sight — the same garment that once carried false blood now carrying healing.
- **Visual:** The garment a **third time** — now **clean and luminous**, lifted toward soft white light, the stain and the tear gone. *Motif: the Shirt (restored) — the arc completes.*

### P16 — The Dream Fulfilled, and the Lesson
- **Verse:** 12:100, 111
- **ON SCREEN:** *"Father, this is the fulfillment of my vision of long ago. My Lord has made it come true."* · *"In their stories is a lesson for those who possess intelligence."*
- **Narration:** The family bowed — and the boy's dream stood fulfilled, decades on. Not a fabricated tale, the Qur'an says, but guidance and mercy for those who reflect.
- **Visual:** Callback to **P2's eleven stars, sun, and moon** — in a manga "reveal," they resolve into the bowing family: the **eleven stars as the brothers, the sun and moon as the parents**, all inclining toward an empty, radiant **throne**. (No silhouettes here — the parents include Yaʿqub, peace be upon him; the celestial symbols *are* the family, exactly as the opening dream meant. Yusuf, peace be upon him, is the light upon the throne, never drawn.) The eight-point star pattern of P1 completes, gold on indigo. *Motif: the dream becomes its own meaning; celestial + geometry both close.*

---

## Decisions (locked 2026-06-02)
- ✅ **All 16 panels** — full arc, no merges.
- ✅ **Names split** — narration uses **Yusuf / Yaʿqub**; the ON-SCREEN verse keeps the verified "Joseph / Jacob."
- ✅ **Honorific** — **(peace be upon him)** on prophets' names, first mention per panel. (ﷺ is for the Prophet Muhammad only.)
- ✅ **Narration audio in v1** — Kokoro-82M third-person (see Render rules).
- ✅ **Motion** — a subtle per-scene Ken Burns drift (slow scale + pan, native-driver, eased ping-pong) gives each still scene a living, cinematic feel; the direction is chosen per scene (push into the well, rise toward the dream's stars, pan across the grain, push to the throne at the finale).
- ✅ **Art direction — aniconic manga, in color.** Manga's energy (linework, screentone, dramatic paneling, dynamic angles, emotional light/weather, speed lines) in warm color. **Ordinary people render as unstructured white silhouettes** (luminous, faceless, no anatomy); **prophets are never depicted, not even as a silhouette** — represented by objects / the shirt / the throne / light / a reverent empty space. Generated-then-human-reviewed per panel (negative prompts are not a safeguard on FLUX — every panel is eyeballed so no prophet-form or detailed figure slips in).
