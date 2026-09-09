# Attempt 10 Interpreter Revision 2 — Pocket responsive background

## Verdict

`PASS_WITH_CONSTRAINTS_CORRECTED`

Revision 2 Evidence 纠正了上一版 Interpreter 的一个语义错误：官网确实在 Desktop 与 Mobile computed style 中绑定了不同 URL，但两个官方 URL 当前返回的是 **同一份字节内容**。

- Desktop URL：`background.jpg`
- Mobile URL：`header_bg-small.jpg`
- 两者尺寸：`720×464`
- 两者 SHA-256：`4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`

因此它是 **viewport-specific URL alias binding**，不是 art-directed visual substitution。后续实现可以保留两个 URL/本地角色，也可以复用同一份已验证字节；但不得再声称手机使用了视觉不同的专用图片，也不得为了体现“响应式”而造出一张不同的手机背景。

## QA 口径变化

QA 应检查：

1. Desktop 与 Mobile 是否保持各自被观察到的 URL/实现角色，或明确复用了相同已验证 payload；
2. 实际画面是否忠于同一张官方图片；
3. 是否错误制造了 breakpoint artwork difference。

QA **不能**再因“跨 breakpoint 视觉资产发生变化”给分，因为当前证据明确否定了这种变化。

## 保持不变的品牌解释

除背景语义外，以下 approved patterns 不变：

- Desktop 50/50 asset-left / copy-right；
- Mobile asset-first / copy-second；
- 单一透明 `logo-cards.png` 组合资产；
- 本区块局部的黑色 copy panel；
- Kanit italic H2 与 PT Sans body/CTA；
- 白色 CTA、黑色 resting foreground、金色 hover foreground；
- CTA 指向 Pocket 独立官网。

Motion 仍只确认 hidden 与 settled endpoints；中间帧、duration、easing、stagger 和 sequence 全部保持 `UNRESOLVED`。

## 范围边界

不同 URL alias 不等于不同视觉资产，更不能泛化成全站 art direction 规则。50/50、black panel、mobile order、背景 binding、字体和 hover 都继续严格限制在 Pocket section。浏览器扩展红色浮层仍为污染，属于 `mustNotInvent`。

本轮没有读取 Demo，也没有提出视觉实现变更；Evidence 已说明当前 Demo 两个本地文件都匹配官方 hash，因此这次修订影响 provenance 与验收语义，不要求改变渲染像素。
