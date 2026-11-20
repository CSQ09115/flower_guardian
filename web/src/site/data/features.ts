/**
 * Feature cards, copied verbatim from `legacy/index.html` (#features).
 * `extra` selects the bespoke mini-widget rendered inside the card.
 */
export type Feature = {
  icon: string;
  tone?: "coral" | "sand";
  tag: string;
  title: string;
  body: string;
  extra?: "remind" | "chat" | "chart";
};

export const FEATURES: Feature[] = [
  {
    icon: "Bell",
    tag: "智能提醒",
    title: "提醒跟着你家的位置走",
    body: "南阳台和北卧室，浇水间隔不一样；延期一次，下一次提醒会自动往后推。",
    extra: "remind",
  },
  {
    icon: "Stethoscope",
    tone: "coral",
    tag: "病症诊断",
    title: "叶子黄了，先拍给 AI 看",
    body: "黄叶、斑点、萎蔫先给预诊；拿不准，再发到社区急诊室，让老花友接一手。",
  },
  {
    icon: "Bug",
    tone: "sand",
    tag: "双模型",
    title: "植物和病虫害，一张图两个结果",
    body: "植物识别覆盖 47 类室内植物、花卉和蔬菜；病虫害模型单独看昆虫、病害和生理性障碍。",
  },
  {
    icon: "MessageQuestion",
    tag: "AI 植物医生",
    title: "能接着往下聊",
    body: "不只是给一个结论。问它“那现在要不要换盆”，它接着答。",
    extra: "chat",
  },
  {
    icon: "ChartLine",
    tone: "coral",
    tag: "养花日记",
    title: "它的成长，有一条生命线",
    body: "每周一张同角度照片，高度和叶片数自己长成曲线。翻回去看，比记忆可靠。",
    extra: "chart",
  },
];