# Attempt 08 · Revision 2 Demo Implementation

Blind QA 的五项 blocker 已逐项修正；本实现节点不签最终视觉 PASS。

- 移动端在标题对齐位置操作 Next、Previous、直接圆点与键盘 Enter，`.phone-screen.scrollTop` 全程保持 `352`。
- 最终 computed typography：标题 Kanit 700 italic（48/32）；More PT Sans 18/800 italic；CTA PT Sans 20/18、700 italic。未再被 Oxanium 覆盖。
- WHAT'S NEW 末端增加 24px、全宽、source-supported red seam；没有修改下一 Section 内容或重做其布局。
- `reducedMotion=1` 使用与 `prefers-reduced-motion` 相同的 runtime 分支：切换后无 outgoing DOM，`animation-name:none`、animation/transition duration `0s`，内容立即变化且 scrollTop 保持 352。
- 新增独立 held-out proof route：`proof=heldout-news`。它使用独立生成 SVG、不同信息和 CTA，并明确标注非官方；不进入六条官方轮播，官方桌面三页/手机六页保持不变。

等待全新 Blind QA 复验。
