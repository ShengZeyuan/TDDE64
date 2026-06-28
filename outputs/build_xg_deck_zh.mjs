import path from "node:path";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import {
  C,
  L,
  colLayout,
  addFooter,
  addSlideTitle,
  addPanel,
  addMetric,
  addBullets,
  addBarChart,
  addSectionLabel,
  addCallout,
  addThreeColCards,
  textOpts,
} from "./deck_shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "xg_project_presentation_中文.pptx");
const EYEBROW = "预期进球（xG）建模";
const FOOTER = "xG 项目 · TDDE64 体育数据分析";

const metrics = [
  ["逻辑回归", "无", 0.771, 0.329, 0.167, 0.097, 0.993, false],
  ["逻辑回归", "类别权重", 0.771, 0.329, 0.321, 0.684, 0.718, true],
  ["逻辑回归", "SMOTE", 0.771, 0.328, 0.321, 0.672, 0.725, false],
  ["XGBoost", "无", 0.764, 0.321, 0.170, 0.100, 0.992, false],
  ["XGBoost", "类别权重", 0.763, 0.323, 0.321, 0.673, 0.723, false],
  ["XGBoost", "SMOTE", 0.755, 0.310, 0.334, 0.333, 0.928, false],
];

const competitions = [
  ["英格兰", 8800, 10.6],
  ["西班牙", 8428, 10.8],
  ["意大利", 9215, 9.6],
  ["德国", 7181, 10.6],
  ["法国", 8841, 10.2],
  ["世界杯", 1501, 9.0],
  ["欧洲杯", 1280, 7.6],
];

const importance = [
  ["头球/身体部位", 16.71],
  ["射门角度", 9.89],
  ["脚部射门", 9.56],
  ["射门距离", 9.04],
  ["任意球", 4.22],
  ["比分差", 2.69],
  ["x 坐标", 2.51],
  ["比赛分钟", 2.44],
  ["y 坐标", 2.14],
];

async function main() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Zeyuan Sheng";
  pptx.title = "预期进球（xG）建模项目汇报";
  pptx.subject = "TDDE64 Sports Analytics";

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    s.addShape("rect", { x: 0, y: 0, w: 0.08, h: L.slideH, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
    s.addText("预期进球（xG）建模", { x: 0.55, y: 0.55, w: 5.4, h: 0.65, ...textOpts({ fontSize: 32, bold: true }) });
    s.addText("基于 Wyscout 公开事件数据的射门质量预测", { x: 0.58, y: 1.2, w: 5.2, h: 0.35, ...textOpts({ fontSize: 13, color: C.muted }) });
    s.addShape("rect", { x: 0.55, y: 1.65, w: 5.0, h: 0.02, fill: { color: C.ink }, line: { color: C.ink, width: 0 } });
    s.addText("可复现的 ML 流水线：提取射门、构造 xG 特征，并比较逻辑回归与 XGBoost。", { x: 0.58, y: 1.85, w: 5.0, h: 0.95, ...textOpts({ fontSize: 12, lineSpacingMultiple: 1.15 }) });
    addPanel(s, 5.85, 1.45, 3.7, 2.95);
    addMetric(s, "射门样本", "45,246", 6.05, 1.65, 3.3, C.accent);
    addMetric(s, "赛事数量", "7", 6.05, 2.35, 3.3);
    addMetric(s, "最佳 AUC-ROC", "0.771", 6.05, 3.05, 3.3, C.blue);
    addFooter(s, FOOTER, 1);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "问题定义");
    s.addText("任务不是预测比赛胜负，而是预测单次射门转化为进球的概率。", { x: L.mx, y: L.bodyY, w: 5.2, h: 0.55, ...textOpts({ fontSize: 12.5, bold: true, lineSpacingMultiple: 1.1 }) });
    addBullets(s, ["分析单位：一次射门事件", "输入：位置、几何特征、身体部位、任意球、比赛时间、比分", "输出：进球概率，即 xG 值"], L.mx, 1.65, 5.0, { fontSize: 10.5, h: 1.5 });
    addPanel(s, 5.75, 1.15, 3.8, 2.55);
    s.addText("xG", { x: 6.55, y: 1.55, w: 2.2, h: 0.6, align: "center", ...textOpts({ fontSize: 36, bold: true, color: C.accent }) });
    s.addText("P(进球 | 射门特征)", { x: 5.95, y: 2.25, w: 3.4, h: 0.28, align: "center", ...textOpts({ fontSize: 12, bold: true }) });
    s.addText("射门质量的概率模型", { x: 5.95, y: 2.6, w: 3.4, h: 0.35, align: "center", ...textOpts({ fontSize: 9.5, color: C.muted }) });
    addFooter(s, FOOTER, 2);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "数据与代码流水线");
    const steps = [
      ["下载", "Wyscout 公开 JSON"],
      ["提取", "筛选射门，剔除点球"],
      ["特征工程", "距离、角度、身体部位等"],
      ["训练", "LR & XGBoost × 3 策略"],
      ["输出", "指标、ROC、特征重要性"],
    ];
    const { colW, x } = colLayout(5, 0.08);
    const cardY = 1.15, cardH = 1.75;
    steps.forEach(([title, desc], i) => {
      const left = x(i);
      addPanel(s, left, cardY, colW, cardH);
      s.addText(String(i + 1).padStart(2, "0"), { x: left + 0.08, y: cardY + 0.1, w: 0.3, h: 0.18, ...textOpts({ fontSize: 8, bold: true, color: C.accent }) });
      s.addText(title, { x: left + 0.08, y: cardY + 0.32, w: colW - 0.16, h: 0.22, ...textOpts({ fontSize: 10.5, bold: true }) });
      s.addText(desc, { x: left + 0.08, y: cardY + 0.58, w: colW - 0.16, h: cardH - 0.68, valign: "top", ...textOpts({ fontSize: 8, color: C.muted, lineSpacingMultiple: 1.08 }) });
    });
    addCallout(s, "关键设计：score_diff 在射门结果之前记录，避免目标泄漏。", L.mx, 3.15, L.cw, 0.48);
    addFooter(s, FOOTER, 3);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "数据集概览");
    addPanel(s, L.mx, L.bodyY, L.cw, 0.62);
    addMetric(s, "过滤后射门数", "45,246", 0.65, L.bodyY + 0.08, 2.4, C.accent);
    addMetric(s, "整体进球率", "~10%", 3.2, L.bodyY + 0.08, 1.8);
    addMetric(s, "训练/验证/测试", "70/15/15", 5.2, L.bodyY + 0.08, 2.5, C.blue);
    addSectionLabel(s, "各赛事射门数量", L.mx, 1.75, 4.0);
    addBarChart(s, competitions.map((r) => [r[0], r[1]]), L.mx, 2.0, 4.35, 2.05, C.ink, "射门数");
    addSectionLabel(s, "各赛事进球率", 5.05, 1.75, 3.5);
    s.addTable([
      [{ text: "赛事", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 8.5 } }, { text: "进球率", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 8.5, align: "right" } }],
      ...competitions.map((r) => [{ text: r[0], options: { fontFace: L.font, fontSize: 8.5, color: C.muted } }, { text: `${r[2].toFixed(1)}%`, options: { fontFace: L.font, fontSize: 8.5, color: C.muted, align: "right" } }]),
    ], { x: 5.05, y: 2.0, w: 4.5, colW: [2.7, 1.8], rowH: 0.24, border: { type: "solid", color: C.rule, pt: 0.5 }, margin: 2 });
    addFooter(s, FOOTER, 4);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "实验设计");
    s.addText("在三种类别不平衡策略下，比较两类模型。", { x: L.mx, y: L.bodyY, w: L.cw, h: 0.28, ...textOpts({ fontSize: 12.5, bold: true }) });
    addThreeColCards(s, [
      ["模型", "逻辑回归\nXGBoost"],
      ["不平衡处理", "无\n类别权重\nSMOTE"],
      ["评估指标", "AUC-ROC · AUC-PR\nF1 · 灵敏度 · 特异度\nLog-loss"],
    ], 1.35, 1.55);
    addCallout(s, "为何按比赛分组？同一场比赛的射门不会跨训练/测试集，更贴近真实预测场景。", L.mx, 3.15, L.cw, 0.48, { fill: C.blueSoft, color: C.blue, fontSize: 9 });
    addFooter(s, FOOTER, 5);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "模型结果");
    const header = [
      { text: "模型", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5 } },
      { text: "策略", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5 } },
      { text: "AUC", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "AUC-PR", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "F1", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "灵敏度", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "特异度", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
    ];
    const body = metrics.map(([model, strategy, ...vals]) => {
      const highlight = vals.pop();
      const fill = highlight ? C.accentSoft : C.white;
      return [
        { text: model, options: { fill, fontFace: L.font, fontSize: 7, bold: highlight } },
        { text: strategy, options: { fill, fontFace: L.font, fontSize: 7, bold: highlight } },
        ...vals.map((v) => ({ text: v.toFixed(3), options: { fill, fontFace: L.font, fontSize: 7, align: "center", bold: highlight } })),
      ];
    });
    s.addTable([header, ...body], { x: L.mx, y: 1.05, w: 5.75, colW: [0.95, 0.85, 0.62, 0.72, 0.55, 0.72, 0.72], rowH: 0.26, border: { type: "solid", color: C.rule, pt: 0.5 }, margin: 2 });
    addPanel(s, 6.45, 1.05, 3.1, 2.35);
    addSectionLabel(s, "主要结论", 6.6, 1.15, 2.8);
    addBullets(s, ["逻辑回归在 AUC-ROC 上略优于 XGBoost", "类别权重 / SMOTE 提升召回，但降低特异度", "在基础 xG 特征下，更复杂模型未必更好"], 6.6, 1.45, 2.75, { fontSize: 9, h: 1.7, spaceAfter: 4 });
    addCallout(s, "最佳 AUC-ROC：逻辑回归 + 类别权重 = 0.771", L.mx, 3.65, L.cw, 0.42);
    addFooter(s, FOOTER, 6);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "模型学到了什么");
    addSectionLabel(s, "XGBoost 特征增益（前 9）", L.mx, L.bodyY - 0.05, 4.5);
    addBarChart(s, importance, L.mx, 1.15, 4.5, 2.75, C.blue, "增益");
    addPanel(s, 5.2, 1.15, 4.35, 2.75);
    addSectionLabel(s, "解读", 5.35, 1.25, 4.0);
    addBullets(s, ["射门类型与几何特征占主导信号", "头球/身体部位是增益最高的特征", "角度与距离符合足球直觉中的核心 xG 变量"], 5.35, 1.55, 4.0, { fontSize: 9.5, h: 2.0, spaceAfter: 5 });
    addFooter(s, FOOTER, 7);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "总结与后续工作");
    s.addText("流水线成功将原始事件日志转化为可复现的射门质量模型。", { x: L.mx, y: L.bodyY, w: L.cw, h: 0.35, ...textOpts({ fontSize: 13, bold: true }) });
    const { colW, x } = colLayout(2, 0.15);
    const boxY = 1.45, boxH = 2.35;
    addPanel(s, x(0), boxY, colW, boxH, C.accentSoft);
    addSectionLabel(s, "当前结论", x(0) + 0.12, boxY + 0.12, colW - 0.24, C.accent);
    addBullets(s, ["基础几何特征已解释大部分可测信号", "XGBoost 未明显超越线性基线"], x(0) + 0.12, boxY + 0.45, colW - 0.24, { fontSize: 9.5, h: 1.5, spaceAfter: 4 });
    addPanel(s, x(1), boxY, colW, boxH, C.blueSoft);
    addSectionLabel(s, "后续方向", x(1) + 0.12, boxY + 0.12, colW - 0.24, C.blue);
    addBullets(s, ["概率校准：Brier 分数与可靠性曲线", "在验证集上进行超参数调优", "丰富上下文：防守压力、助攻类型、门将位置、射门前序列"], x(1) + 0.12, boxY + 0.45, colW - 0.24, { fontSize: 9, h: 1.6, color: C.blue, spaceAfter: 4 });
    addFooter(s, FOOTER, 8);
  }

  await pptx.writeFile({ fileName: OUT });
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
