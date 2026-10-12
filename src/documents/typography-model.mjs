export const typographyRecipes = [
    ...[
      ["H", 700, "标题/强强调"],
      ["B", 500, "正文强调/组件标题"],
      ["N", 400, "正文/说明/辅助"],
    ].flatMap(([prefix, weight, usage]) =>
      [
        [1, 32, 40],
        [2, 28, 36],
        [3, 24, 32],
        [4, 20, 28],
        [5, 18, 26],
        [6, 16, 24],
        [7, 14, 22],
        [8, 12, 18],
      ].map(([level, size, lineHeight]) => ({
        title: `${prefix}${level}`,
        value: `${size}px / ${weight} / ${lineHeight}px`,
        note: `${usage}，按 H/B/N typography scale 表达；落到 DangoUI 时由组件源码或页面 CSS 承接。`,
      })),
    ),
    { title: "Font family", value: "system-ui / brand font asset", note: "字体族单独记录；DangoUI 当前快照没有全局 font-family token，品牌字体包进入 demoOnlyVisualControls。" },
    { title: "Letter spacing", value: "0 by default", note: "普通 UI 文本不加负字距；品牌标题若有字距证据单独记录。" },
  ];
export function buildTypographyGroups() {
  const labels = {
    H: "标题 / 强强调",
    B: "正文强调 / 组件标题",
    N: "正文 / 说明 / 辅助",
  };
  const rows = (typographyRecipes || [])
    .filter((item) => /^[HBN][1-8]$/.test(item.title))
    .map((item) => {
      const parts = String(item.value).split("/").map((part) => Number.parseFloat(part) || 0);
      return {
        ...item,
        family: item.title[0],
        size: parts[0] || 12,
        weight: parts[1] || 400,
        lineHeight: parts[2] || parts[0] || 18,
      };
    });
  return ["H", "B", "N"].map((id) => ({
    id,
    label: labels[id],
    items: rows.filter((item) => item.family === id),
  }));
}
export const typographyGroups = buildTypographyGroups();
