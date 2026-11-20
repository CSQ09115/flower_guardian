/** Spec strip, copied verbatim from `legacy/index.html` (#spec). */
export const SPEC: { label: string; value: string }[] = [
  { value: "47", label: "类室内植物、花卉、蔬菜" },
  { value: "2", label: "个 YOLOv11 模型：植物与病虫害" },
  { value: "4", label: "类提醒：浇水、施肥、换盆、修剪" },
  { value: "5", label: "个问题，生成新手推荐" },
  { value: "1", label: "条生命线：高度与叶片数" },
  { value: "ONNX", label: "服务器端与边缘端都能跑" },
];

export const SPEC_NOTE =
  "数字来自项目 README 与 App 现有功能。识别模型以 ONNX 部署；拍照识别与 AI 对话需要网络。";