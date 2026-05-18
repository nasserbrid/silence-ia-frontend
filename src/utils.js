export const applyMob = (isMobile, desktop, mobileExtra) =>
  isMobile ? { ...desktop, ...mobileExtra } : desktop;

export const transformSession = (s) => ({
  id: s.id,
  date: s.created_at,
  typeDiscours: s.type_discours,
  typeDiscoursLabel: s.type_discours_label,
  dureeMinPrevue: s.duree_prevue_min,
  dureeEffectiveSec: s.duree_effective_sec,
  transcription: s.transcription,
  analyse: s.analyse,
  wordCount: s.word_count,
});

export const extractScore = (text) => {
  if (!text) return null;
  const m =
    text.match(/score\s+(?:global|final)\s*:\s*(\d{1,3})\s*%/i) ||
    text.match(/\*\*score\s+(?:global|final)\s*:\s*(\d{1,3})\s*%\*\*/i) ||
    text.match(/(\d{1,3})\s*%/);
  if (m) { const n = parseInt(m[1]); if (n >= 0 && n <= 100) return n; }
  return null;
};

export const extractCitation = (text) => {
  if (!text) return null;
  const re = /[«"]([^«»"]{20,300})[»"]/g;
  const c = [];
  let m;
  while ((m = re.exec(text)) !== null) c.push(m[1].trim());
  return c.length ? c[c.length - 1] : null;
};

export const extractSynthese = (text) => {
  if (!text) return null;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/score\s+(?:global|final)\s*:\s*\d{1,3}\s*%/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const c = lines[j].trim().replace(/^\*+|\*+$/g, "").trim();
        if (c && !c.startsWith("---") && !c.startsWith("#")) return c;
      }
    }
  }
  return null;
};

export const fmtTime = (s) => {
  const m = Math.floor(s / 60), sec = s % 60;
  return m + ":" + (sec < 10 ? "0" + sec : sec);
};
