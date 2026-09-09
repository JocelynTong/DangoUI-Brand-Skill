# Attempt 10 Evidence Revision 2 — Responsive background identity

## 结论

旧说法“手机端使用不同设计的专用背景图”是错误的，现已撤回。

- Desktop 1440 computed URL：`.../tcg-pocket/background.jpg`
- Mobile 390 computed URL：`.../tcg-pocket/header_bg-small.jpg`
- 两文件 natural size 都是 **720×464**。
- 两文件 SHA256 都是 **4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976**。

因此官网确实通过 CSS 在不同视口选择不同 URL，但当前两个官方响应是完全相同的字节。准确语义是 **responsive URL aliases / same content**，不是 art-directed different asset。

## 对旧 Evidence 的处置

`pocket-mobile` 中“mobile-specific background”若表示“不同 URL”，成立；若表示“不同视觉内容/不同文件字节”，则 **REJECTED**。后续 Interpreter 和 Demo 不得基于文件名推导移动端有一套不同构图。
