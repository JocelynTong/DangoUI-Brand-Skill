export function detectBlockedHtml(html) {
  const text = String(html || "");
  if (!text) return null;
  const rules = [
    {
      code: "incapsula-block",
      pattern: /(?:Request unsuccessful\.\s*Incapsula incident ID|_Incapsula_Resource[^\n]{0,240}(?:incident|challenge|blocked))/i,
    },
    {
      code: "cloudflare-block",
      pattern: /(?:cf-browser-verification|cf-chl-(?:widget|opt|bypass)|challenge-platform|<title>\s*Just a moment\.\.\.\s*<\/title>|Attention Required[^\n]{0,240}Cloudflare)/i,
    },
    {
      code: "akamai-block",
      pattern: /(?:Access Denied[^\n]{0,240}Reference #\d+\.[\w.]+|Akamai[^\n]{0,160}(?:bot manager|denied|reference #))/i,
    },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.code;
  }
  return null;
}
