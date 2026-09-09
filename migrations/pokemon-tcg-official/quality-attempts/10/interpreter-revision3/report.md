# Attempt 10 Interpreter Revision 3 — Pocket 背景与内容层级

## Verdict

`PASS_WITH_CONSTRAINTS_CORRECTED`

Revision 3 纠正的是桌面父子层级：Pocket 的浅色 campaign background 不是左栏背景，而是铺满整个 `1440×476.195` article 的绝对定位父层。左右 50/50 只描述上方 content row 的内容几何。

## 正确层级

Desktop 1440：

```text
article 1440×476.195
├─ light background  absolute，铺满 section
└─ transparent content row  1440×476.195
   ├─ transparent asset column  720×476.195
   └─ black copy panel  720×356.5，y=59.844
```

黑 panel 只遮住右侧中段；其上方约 `59.84px`、下方约 `59.85px` 仍露出同一个浅色父背景。实现成“左浅右黑两个等高背景块”或“整段父层黑色”都属于结构性错误。

Mobile 390：背景同样铺满 `390×743.023` article。透明 asset row 为 `390×334`；其后的黑 panel 为 `390×409`，完整覆盖下段背景，不留上下或左右露边。移动端的“黑色覆盖完整下段”不能反向泛化成整个父 section 为黑色。

## Responsive alias 结论不变

Desktop `background.jpg` 与 Mobile `header_bg-small.jpg` 是两个 viewport URL alias，但当前官方响应同为 `720×464`，SHA-256 均为 `4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`。

这属于 URL-role binding，不是视觉不同的 art-directed substitution；QA 不得为不存在的视觉换图给分。

## 必须禁止“父层整段黑色”的 Patterns

- `PAT-POCKET-01`：它拥有父背景职责，必须冻结为铺满 article 的浅色 campaign field。
- `PAT-POCKET-02`：它拥有桌面内容几何，必须保留黑 panel 上下的浅色背景露边。
- `PAT-POCKET-03`：它拥有手机上下堆叠，必须保持上方 asset row 透明、只让下段被黑 panel 完全遮挡。
- `PAT-POCKET-05`：它拥有黑色的使用边界，必须明确黑色只属于 copy child，不属于 article、background layer 或 content layer。

## 其余规则

单一透明 `logo-cards.png`、Kanit italic H2、PT Sans body/CTA、白色 CTA、黑到金 hover、Pocket 外链语义均保持不变。

Motion 仍只确认 hidden 与 settled endpoints；中间帧、duration、easing、stagger、sequence 全部 `UNRESOLVED`。浏览器扩展红色浮层仍是污染，属于 `mustNotInvent`。

本轮只读取 Evidence Revision 3，没有读取 Demo。
