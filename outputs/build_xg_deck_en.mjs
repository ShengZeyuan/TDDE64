import path from "node:path";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import {
  C,
  L,
  metrics,
  competitions,
  importance,
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
const OUT = path.join(__dirname, "xg_project_presentation_english.pptx");
const EYEBROW = "EXPECTED GOALS MODELING";
const FOOTER = "xG project · TDDE64 Sports Analytics";

async function main() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Zeyuan Sheng";
  pptx.title = "Expected Goals Modeling";
  pptx.subject = "TDDE64 Sports Analytics";

  // Slide 1 · Title
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    s.addShape("rect", {
      x: 0,
      y: 0,
      w: 0.08,
      h: L.slideH,
      fill: { color: C.accent },
      line: { color: C.accent, width: 0 },
    });
    s.addText("Expected Goals", {
      x: 0.55,
      y: 0.55,
      w: 5.4,
      h: 0.65,
      ...textOpts({ fontSize: 32, bold: true }),
    });
    s.addText("Modeling shot quality from Wyscout open event data", {
      x: 0.58,
      y: 1.2,
      w: 5.2,
      h: 0.35,
      ...textOpts({ fontSize: 13, color: C.muted }),
    });
    s.addShape("rect", {
      x: 0.55,
      y: 1.65,
      w: 5.0,
      h: 0.02,
      fill: { color: C.ink },
      line: { color: C.ink, width: 0 },
    });
    s.addText(
      "A reproducible ML pipeline: extract shots, engineer xG features, and compare Logistic Regression with XGBoost.",
      { x: 0.58, y: 1.85, w: 5.0, h: 0.95, ...textOpts({ fontSize: 12, lineSpacingMultiple: 1.15 }) },
    );
    addPanel(s, 5.85, 1.45, 3.7, 2.95);
    addMetric(s, "shot-level samples", "45,246", 6.05, 1.65, 3.3, C.accent);
    addMetric(s, "competitions", "7", 6.05, 2.35, 3.3);
    addMetric(s, "best AUC-ROC", "0.771", 6.05, 3.05, 3.3, C.blue);
    addFooter(s, FOOTER, 1);
  }

  // Slide 2 · Problem
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "Problem Framing");
    s.addText(
      "The task is not to predict match winners — it estimates the probability that a single shot becomes a goal.",
      { x: L.mx, y: L.bodyY, w: 5.2, h: 0.55, ...textOpts({ fontSize: 12.5, bold: true, lineSpacingMultiple: 1.1 }) },
    );
    addBullets(
      s,
      [
        "Unit of analysis: one shot event",
        "Inputs: location, geometry, body part, free-kick flag, match time, score context",
        "Output: a goal probability — the xG value",
      ],
      L.mx,
      1.65,
      5.0,
      { fontSize: 10.5, h: 1.5 },
    );
    addPanel(s, 5.75, 1.15, 3.8, 2.55);
    s.addText("xG", {
      x: 6.55,
      y: 1.55,
      w: 2.2,
      h: 0.6,
      align: "center",
      ...textOpts({ fontSize: 36, bold: true, color: C.accent }),
    });
    s.addText("P(goal | shot features)", {
      x: 5.95,
      y: 2.25,
      w: 3.4,
      h: 0.28,
      align: "center",
      ...textOpts({ fontSize: 12, bold: true }),
    });
    s.addText("A probability model for shot quality", {
      x: 5.95,
      y: 2.6,
      w: 3.4,
      h: 0.35,
      align: "center",
      ...textOpts({ fontSize: 9.5, color: C.muted }),
    });
    addFooter(s, FOOTER, 2);
  }

  // Slide 3 · Pipeline
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "Data Pipeline");
    const steps = [
      ["Download", "Wyscout open event and match JSON"],
      ["Extract", "Filter shots; remove penalties"],
      ["Engineer", "Distance, angle, body part, free kick, score diff"],
      ["Train", "LR & XGBoost × 3 imbalance strategies"],
      ["Report", "Metrics, ROC, feature importance, LaTeX"],
    ];
    const { colW, x } = colLayout(5, 0.08);
    const cardY = 1.15;
    const cardH = 1.75;
    steps.forEach(([title, desc], i) => {
      const left = x(i);
      addPanel(s, left, cardY, colW, cardH);
      s.addText(String(i + 1).padStart(2, "0"), {
        x: left + 0.08,
        y: cardY + 0.1,
        w: 0.3,
        h: 0.18,
        ...textOpts({ fontSize: 8, bold: true, color: C.accent }),
      });
      s.addText(title, {
        x: left + 0.08,
        y: cardY + 0.32,
        w: colW - 0.16,
        h: 0.22,
        ...textOpts({ fontSize: 10.5, bold: true }),
      });
      s.addText(desc, {
        x: left + 0.08,
        y: cardY + 0.58,
        w: colW - 0.16,
        h: cardH - 0.68,
        valign: "top",
        ...textOpts({ fontSize: 8, color: C.muted, lineSpacingMultiple: 1.08 }),
      });
    });
    addCallout(
      s,
      "Key design: score_diff is captured before the shot outcome, avoiding target leakage.",
      L.mx,
      3.15,
      L.cw,
      0.48,
    );
    addFooter(s, FOOTER, 3);
  }

  // Slide 4 · Dataset
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "Dataset Snapshot");
    addPanel(s, L.mx, L.bodyY, L.cw, 0.62);
    addMetric(s, "total shots (filtered)", "45,246", 0.65, L.bodyY + 0.08, 2.4, C.accent);
    addMetric(s, "overall goal rate", "~10%", 3.2, L.bodyY + 0.08, 1.8);
    addMetric(s, "train / val / test", "70 / 15 / 15", 5.2, L.bodyY + 0.08, 2.5, C.blue);
    addSectionLabel(s, "Shots by competition", L.mx, 1.75, 4.0);
    addBarChart(s, competitions.map((r) => [r[0], r[1]]), L.mx, 2.0, 4.35, 2.05, C.ink, "Shots");
    addSectionLabel(s, "Goal rate by competition", 5.05, 1.75, 3.5);
    s.addTable(
      [
        [
          { text: "Competition", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 8.5 } },
          { text: "Goal rate", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 8.5, align: "right" } },
        ],
        ...competitions.map((r) => [
          { text: r[0], options: { fontFace: L.font, fontSize: 8.5, color: C.muted } },
          { text: `${r[2].toFixed(1)}%`, options: { fontFace: L.font, fontSize: 8.5, color: C.muted, align: "right" } },
        ]),
      ],
      {
        x: 5.05,
        y: 2.0,
        w: 4.5,
        colW: [2.7, 1.8],
        rowH: 0.24,
        border: { type: "solid", color: C.rule, pt: 0.5 },
        margin: 2,
      },
    );
    addFooter(s, FOOTER, 4);
  }

  // Slide 5 · Experiment
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "Experiment Design");
    s.addText("Two model families compared under three class-imbalance strategies.", {
      x: L.mx,
      y: L.bodyY,
      w: L.cw,
      h: 0.28,
      ...textOpts({ fontSize: 12.5, bold: true }),
    });
    addThreeColCards(
      s,
      [
        ["Models", "Logistic Regression\nXGBoost"],
        ["Imbalance handling", "None\nClass weight\nSMOTE"],
        ["Evaluation", "AUC-ROC · AUC-PR\nF1 · Sensitivity · Specificity\nLog-loss"],
      ],
      1.35,
      1.55,
    );
    addCallout(
      s,
      "Why group by match? Shots from the same match never cross folds — the test set better simulates unseen matches.",
      L.mx,
      3.15,
      L.cw,
      0.48,
      { fill: C.blueSoft, color: C.blue, fontSize: 9 },
    );
    addFooter(s, FOOTER, 5);
  }

  // Slide 6 · Results
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "Model Results");
    const header = [
      { text: "Model", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5 } },
      { text: "Strategy", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5 } },
      { text: "AUC", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "AUC-PR", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "F1", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "Sens.", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
      { text: "Spec.", options: { bold: true, fill: C.light, fontFace: L.font, fontSize: 7.5, align: "center" } },
    ];
    const body = metrics.map(([model, strategy, ...vals]) => {
      const highlight = vals.pop();
      const fill = highlight ? C.accentSoft : C.white;
      return [
        { text: model, options: { fill, fontFace: L.font, fontSize: 7, bold: highlight } },
        { text: strategy, options: { fill, fontFace: L.font, fontSize: 7, bold: highlight } },
        ...vals.map((v) => ({
          text: v.toFixed(3),
          options: { fill, fontFace: L.font, fontSize: 7, align: "center", bold: highlight },
        })),
      ];
    });
    s.addTable([header, ...body], {
      x: L.mx,
      y: 1.05,
      w: 5.75,
      colW: [1.35, 0.95, 0.62, 0.72, 0.55, 0.62, 0.62],
      rowH: 0.26,
      border: { type: "solid", color: C.rule, pt: 0.5 },
      margin: 2,
    });
    addPanel(s, 6.45, 1.05, 3.1, 2.35);
    addSectionLabel(s, "Main readout", 6.6, 1.15, 2.8);
    addBullets(
      s,
      [
        "Logistic Regression slightly leads on AUC-ROC",
        "Class weighting and SMOTE improve recall but reduce specificity",
        "More complex models do not automatically win with basic xG features",
      ],
      6.6,
      1.45,
      2.75,
      { fontSize: 9, h: 1.7, spaceAfter: 4 },
    );
    addCallout(s, "Best AUC-ROC: Logistic Regression + class weight = 0.771", L.mx, 3.65, L.cw, 0.42);
    addFooter(s, FOOTER, 6);
  }

  // Slide 7 · Feature importance
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "What the Model Learns");
    addSectionLabel(s, "XGBoost feature gain (top 9)", L.mx, L.bodyY - 0.05, 4.5);
    addBarChart(s, importance, L.mx, 1.15, 4.5, 2.75, C.blue, "Gain");
    addPanel(s, 5.2, 1.15, 4.35, 2.75);
    addSectionLabel(s, "Interpretation", 5.35, 1.25, 4.0);
    addBullets(
      s,
      [
        "Shot type and geometry dominate the signal",
        "Header / body-part indicator is the strongest gain feature",
        "Angle and distance remain core xG variables — matching football intuition",
      ],
      5.35,
      1.55,
      4.0,
      { fontSize: 9.5, h: 2.0, spaceAfter: 5 },
    );
    addFooter(s, FOOTER, 7);
  }

  // Slide 8 · Conclusion
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addSlideTitle(s, EYEBROW, "Conclusion and Next Steps");
    s.addText("The pipeline turns raw event logs into a reproducible shot-quality model.", {
      x: L.mx,
      y: L.bodyY,
      w: L.cw,
      h: 0.35,
      ...textOpts({ fontSize: 13, bold: true }),
    });
    const { colW, x } = colLayout(2, 0.15);
    const boxY = 1.45;
    const boxH = 2.35;
    addPanel(s, x(0), boxY, colW, boxH, C.accentSoft);
    addSectionLabel(s, "Current conclusion", x(0) + 0.12, boxY + 0.12, colW - 0.24, C.accent);
    addBullets(
      s,
      [
        "Basic geometric features already explain most of the measurable signal",
        "XGBoost does not clearly outperform the linear baseline on this feature set",
      ],
      x(0) + 0.12,
      boxY + 0.45,
      colW - 0.24,
      { fontSize: 9.5, h: 1.5, spaceAfter: 4 },
    );
    addPanel(s, x(1), boxY, colW, boxH, C.blueSoft);
    addSectionLabel(s, "Future work", x(1) + 0.12, boxY + 0.12, colW - 0.24, C.blue);
    addBullets(
      s,
      [
        "Add calibration analysis: Brier score and reliability curves",
        "Tune hyperparameters on the validation fold",
        "Richer context: defender pressure, assist type, GK position, pre-shot sequence",
      ],
      x(1) + 0.12,
      boxY + 0.45,
      colW - 0.24,
      { fontSize: 9, h: 1.6, color: C.blue, spaceAfter: 4 },
    );
    addFooter(s, FOOTER, 8);
  }

  await pptx.writeFile({ fileName: OUT });
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
