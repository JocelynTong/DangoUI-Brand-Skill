# Attempt 10 Evidence Revision 3 — Pocket 背景层级

## 最早被纠正的说法

早期把桌面构图概括成“左侧浅蓝背景区 + 右侧黑色内容区”，这会让实现者误以为背景只存在于左半边。该说法现已纠正。

## Desktop 1440 的真实层级

```text
article.tcg-pocket  1440 × 476.195  position: relative
├─ .full-width-section__bg       absolute，铺满 1440 × 476.195
└─ .full-width-section__content  relative，铺满 1440 × 476.195
   └─ .row                       flex，铺满 section
      ├─ asset column            720 × 476.195，透明
      └─ black copy panel        720 × 356.5，垂直居中
```

背景层使用 `background.jpg`、`cover`、`100% 50%`，横跨整个 section。右侧黑面板只是内容层中的一个 flex child，并不等于“右半区背景”：

- 面板 layout x = 720
- 面板距 section 顶部 = 59.844px
- 面板高度 = 356.5px
- 面板下方仍露出底层背景 = 59.852px

因此桌面正确画法是“全宽背景 + 叠加的右侧居中黑面板”，不是左右两块互斥背景。

## Mobile 390 的真实层级

背景层仍铺满整个 390×743.023 article；content row 改为 block：

- 上层资产区：390×334，透明，可看到背景。
- 下层 copy panel：390×409，纯黑，完整覆盖下半段背景。

手机黑面板没有桌面那样的上下背景露边。

## Revision 2 继续有效

`background.jpg` 与 `header_bg-small.jpg` 是不同 CSS URL alias，但官方响应字节完全相同：两者均为 720×464，SHA256 均为 `4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`。不能再解释成移动端 art-directed different asset。
