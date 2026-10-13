export const cznCompositions = [
  { id: 'media-stage', label: '媒体舞台', description: '背景、标题与内容分层，封面用于静态阅读。' },
  { id: 'character-profile', label: '角色资料', description: '角色图像、身份与状态说明配合展示。' },
  { id: 'skill-list', label: '技能列表', description: '图标与名称逐项对应，不新增技能详情。' },
  { id: 'archive-timeline', label: '档案与序号', description: '虚构档案按序阅读，不代表实时信号或真实数据。' },
];
export const cznFoundations = {
  overview: ['视觉总览', '深色舞台承载角色，浅色文字建立层次，橙色只标记局部当前位置。'],
  color: ['颜色', '橙色来自当前导航标记，不推广为所有按钮的品牌色。'],
  typography: ['字体与层级', '中文标题配合紧凑英文标识；以下使用系统字体，不承诺官方字体复刻。'],
  icon: ['图标', '技能图标与名称一一对应；装饰图案不能代替可读标签。'],
  asset: ['图片资产', '角色封面与技能图分开呈现，保留比例。外链素材加载取决于网络。'],
  divider: ['分割线', '细线组织资料，深色背景中的文字保持清楚。'],
  layout: ['布局', '舞台用于氛围，资料用于阅读，序号用于定位；不把整页压成一张图片。'],
  spacing: ['间距', '角色与资料留出空间，技能内部紧凑排列；这是 demo 示意，不是官方尺寸规范。'],
  radius: ['圆角', '角色与技能素材保留完整轮廓，不以统一大圆角裁切所有图片。'],
  shadow: ['阴影', '深浅层次与边界负责分组，文档不额外堆叠悬浮投影。'],
  motion: ['动效', '页面示例保留已有视频和状态切换，文档使用静态封面，不新增自动播放。'],
};
export function cznSamples(preview) {
  const section = id => preview.pages?.flatMap(page => page.sections || []).find(item => item.id === id);
  return { home: section('czn-home-stage'), gameplay: section('czn-gameplay-stage')?.content?.items || [], characters: section('czn-character-stage')?.content?.items || [], archives: section('czn-heldout-stage')?.content?.items || [] };
}
