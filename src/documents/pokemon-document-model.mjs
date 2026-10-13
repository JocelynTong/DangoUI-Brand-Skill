export const pokemonCompositions = [
  { id: 'campaign', label: '品牌舞台', description: '背景、标识与卡面分层，保留完整卡牌。' },
  { id: 'query-layout', label: '查询布局', description: '字段、条件与操作分组；只展示，不执行搜索。' },
  { id: 'story-card', label: '资讯卡片', description: '图片与标题建立清楚的阅读入口。' },
  { id: 'card-anatomy', label: '卡面讲解', description: '完整卡面配合文字说明，不把标注写进图片。' },
];
export const pokemonFoundations = {
  overview: ['视觉总览', '舞台吸引注意，卡面保持完整，查询与讲解负责清楚地传达信息。'],
  color: ['颜色', '阅读使用深色文字与浅色底面；品牌素材的颜色不等于通用按钮颜色。'],
  typography: ['字体与层级', '标题、卡牌标识与正文分层；示例使用系统字体，不宣称官方字体复刻。'],
  icon: ['图标', '能量类型用清楚的文字表达；不凭空补造官方图标。'],
  asset: ['图片资产', '卡面完整显示，资讯图片与舞台背景分别处理，不使用整页截图。'],
  divider: ['分割线', '用细线分开条目，避免给每段内容增加厚重外框。'],
  layout: ['布局', '舞台、查询表单与卡面讲解分别采用对应的信息结构。'],
  spacing: ['间距', '段落之间留白，关联字段靠近；这是 demo 布局示意，不是官方间距 Token。'],
  radius: ['圆角', '尊重素材本身的卡面轮廓，不裁切卡牌，也不把卡面圆角套给所有容器。'],
  shadow: ['阴影', '阅读区域依靠层级和分隔，不为每条说明添加悬浮阴影。'],
  motion: ['动效', '当前页面为静态展示，不把旧记录中的可展开交互当成已开放能力。'],
};
export function pokemonSamples(preview) {
  const section = id => preview.pages?.flatMap(page => page.sections || []).find(item => item.id === id);
  return {
    campaign: section('home-campaign-stage')?.content?.variants?.[0],
    stories: section('home-news-grid')?.content?.stories || [],
    types: section('card-database-search-shell')?.content?.energyTypes || [],
    cards: section('card-database-search-shell')?.assets?.cards || [],
    anatomy: section('learn-card-breakdown'),
  };
}
