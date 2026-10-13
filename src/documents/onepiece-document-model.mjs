export const onepieceCompositions = [
  { id: 'catalog', label: '商品目录', description: '图片、名称、分类与编号组成双列目录。' },
  { id: 'news-card', label: '资讯卡片', description: '以主图、分类、日期和标题组织资讯。' },
  { id: 'hero', label: '品牌主视觉', description: '让活动图片先说话，标题与编号保持清楚。' },
  { id: 'event-card', label: '活动卡片', description: '用图片、介绍和行动文字表达活动层级。' },
  { id: 'pagination', label: '分类与页码', description: '黑白矩形表达分类和当前页，示例不执行筛选或翻页。' },
];
export const onepieceFoundations = {
  overview: ['视觉总览', '强对比的标题、完整的商品图片、清楚的资讯层级。'],
  color: ['颜色', '黑白负责阅读与分类；黄色只用于有来源的局部提示和活动画面，不作为全站选中色。'],
  typography: ['字体与层级', '大标题建立节奏，正文服务阅读，日期和编号保持紧凑。'],
  icon: ['图标', '方向、翻页与外链使用清楚的文字或符号，不把品牌 Logo 当作通用图标。'],
  asset: ['图片资产', '主视觉、商品包装和资讯图片各司其职，保留图像比例和可读信息。'],
  divider: ['分割线', '用细线分隔阅读条目，用深色边界强调目录中的信息层级。'],
  layout: ['布局', '主视觉、资讯列表与商品网格采用不同密度，不套用同一种卡片。'],
  spacing: ['间距', '大段落留呼吸空间，卡片内部保持紧凑；下方是本站布局示意，不是官方间距 Token。'],
  radius: ['圆角', '商品与资讯图片保留直角。局部行动入口的特殊轮廓，不推广成全站大圆角。'],
  shadow: ['阴影', '目录主要依靠对比与边界分组，不额外添加悬浮阴影。'],
  motion: ['动效', '只保留轻量反馈，不新增轮播节奏或推测官方动效参数。'],
};
export function onepieceSamples(preview) {
  const page = suffix => preview.pages?.find(item => item.id === `onepiece-cardgame-${suffix}`);
  const section = (suffix, id) => page(suffix)?.sections?.find(item => item.id === id);
  return {
    products: section('products', 'product-grid')?.assets?.products || [],
    news: section('news', 'news-feature')?.assets?.cards || [],
    events: section('events', 'events-discover')?.assets?.cards || [],
    hero: section('home', 'home-hero'),
    filters: section('news', 'news-tabs')?.content?.items || [],
  };
}
