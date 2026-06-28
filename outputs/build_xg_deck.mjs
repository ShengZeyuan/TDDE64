import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "/Users/bilibili/Downloads/sport analysis project-2/outputs/xg_project_presentation_english.pptx";
const PREVIEW_DIR = "/Users/bilibili/Downloads/sport analysis project-2/outputs/xg_deck_preview";
const LAYOUT_DIR = "/Users/bilibili/Downloads/sport analysis project-2/outputs/xg_deck_layout";

const C = {
  ink: "#111111",
  muted: "#555555",
  light: "#EDEDED",
  rule: "#B8BCC4",
  accent: "#FF6B35",
  blue: "#2F6F9F",
  white: "#FFFFFF",
};

const metrics = [
  ["LR", "None", 0.771, 0.329, 0.167, 0.097, 0.993],
  ["LR", "Class weight", 0.771, 0.329, 0.321, 0.684, 0.718],
  ["LR", "SMOTE", 0.771, 0.328, 0.321, 0.672, 0.725],
  ["XGBoost", "None", 0.764, 0.321, 0.170, 0.100, 0.992],
  ["XGBoost", "Class weight", 0.763, 0.323, 0.321, 0.673, 0.723],
  ["XGBoost", "SMOTE", 0.755, 0.310, 0.334, 0.333, 0.928],
];

const competitions = [
  ["England", 8800, 10.6],
  ["Spain", 8428, 10.8],
  ["Italy", 9215, 9.6],
  ["Germany", 7181, 10.6],
  ["France", 8841, 10.2],
  ["World Cup", 1501, 9.0],
  ["Euro", 1280, 7.6],
];

const importance = [
  ["body_head", 16.71],
  ["angle", 9.89],
  ["body_foot", 9.56],
  ["distance", 9.04],
  ["is_free_kick", 4.22],
  ["score_diff", 2.69],
  ["x", 2.51],
  ["minute", 2.44],
  ["y", 2.14],
];

function addText(slide, text, left, top, width, height, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 1 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: 22,
    color: C.ink,
    ...style,
  };
  return shape;
}

function addPanel(slide, left, top, width, height, fill = C.light) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: "none", width: 1 },
  });
}

function addRule(slide, left, top, width) {
  addPanel(slide, left, top, width, 1, C.rule);
}

function addSlideTitle(slide, title) {
  addText(slide, "EXPECTED GOALS MODELING", 54, 36, 500, 28, {
    fontSize: 15,
    bold: true,
    color: C.muted,
  });
  addText(slide, title, 54, 72, 940, 64, {
    fontSize: 42,
    bold: true,
  });
  addRule(slide, 54, 146, 1172);
}

function footer(slide, n) {
  addText(slide, `xG project / ${n}`, 1090, 672, 136, 24, {
    fontSize: 14,
    color: C.muted,
  });
}

function addBullet(slide, text, left, top, width, opts = {}) {
  slide.shapes.add({
    geometry: "oval",
    position: { left, top: top + 9, width: 7, height: 7 },
    fill: opts.color || C.accent,
    line: { style: "solid", fill: "none", width: 1 },
  });
  addText(slide, text, left + 20, top, width - 20, opts.height || 58, {
    fontSize: opts.fontSize || 21,
    color: opts.textColor || C.ink,
  });
}

function addMetric(slide, label, value, left, top, width, color = C.ink) {
  addText(slide, value, left, top, width, 58, {
    fontSize: 48,
    bold: true,
    color,
  });
  addText(slide, label, left, top + 58, width, 46, {
    fontSize: 17,
    color: C.muted,
  });
}

function addSimpleTable(slide, rows, left, top, colWidths, rowH, fontSize = 15) {
  const width = colWidths.reduce((a, b) => a + b, 0);
  addPanel(slide, left, top, width, rowH, C.light);
  for (let r = 0; r < rows.length; r++) {
    const y = top + r * rowH;
    addRule(slide, left, y, width);
    let x = left;
    for (let c = 0; c < rows[r].length; c++) {
      addText(slide, String(rows[r][c]), x + 8, y + 5, colWidths[c] - 16, rowH - 8, {
        fontSize,
        bold: r === 0,
        color: r === 0 ? C.ink : C.muted,
      });
      x += colWidths[c];
    }
  }
  addRule(slide, left, top + rows.length * rowH, width);
}

function addHorizontalBars(slide, rows, left, top, labelW, barW, rowH, color, valueSuffix = "") {
  const maxValue = Math.max(...rows.map((r) => r[1]));
  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    const y = top + i * rowH;
    addText(slide, label, left, y, labelW, rowH - 3, { fontSize: 15, color: C.muted });
    addPanel(slide, left + labelW, y + 5, barW, 14, "#F1F1F1");
    addPanel(slide, left + labelW, y + 5, Math.max(3, (value / maxValue) * barW), 14, color);
    addText(slide, `${value.toLocaleString()}${valueSuffix}`, left + labelW + barW + 8, y, 90, rowH - 3, {
      fontSize: 14,
      color: C.muted,
    });
  }
}

async function main() {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(LAYOUT_DIR, { recursive: true });

  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addText(s, "Expected Goals", 54, 64, 720, 82, { fontSize: 72, bold: true });
    addText(s, "Modeling shot quality from Wyscout event data", 58, 152, 790, 44, {
      fontSize: 28,
      color: C.muted,
    });
    addPanel(s, 54, 258, 1172, 2, C.ink);
    addText(s, "A compact machine-learning pipeline for extracting shots, engineering xG features, and comparing Logistic Regression with XGBoost.", 58, 310, 660, 126, {
      fontSize: 27,
    });
    addMetric(s, "shot-level samples", "45,246", 818, 310, 300, C.accent);
    addMetric(s, "competitions", "7", 818, 430, 300);
    addMetric(s, "best AUC-ROC", "0.771", 818, 550, 300, C.blue);
    footer(s, 1);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "Problem Framing");
    addText(s, "The task is not to predict match winners. It predicts the probability that a single shot becomes a goal.", 76, 190, 700, 88, {
      fontSize: 30,
      bold: true,
    });
    addBullet(s, "Unit of analysis: one shot event.", 82, 330, 610);
    addBullet(s, "Input: shot location, geometry, body part, free-kick flag, match time, and score context.", 82, 388, 660, { height: 76 });
    addBullet(s, "Output: a probability score, interpreted as expected goals.", 82, 468, 650);
    addPanel(s, 826, 192, 330, 330);
    addText(s, "xG", 930, 250, 130, 82, { fontSize: 78, bold: true, color: C.accent });
    addText(s, "P(goal | shot features)", 868, 360, 260, 42, { fontSize: 25, bold: true });
    addText(s, "A probability model for shot quality", 878, 420, 240, 72, { fontSize: 20, color: C.muted });
    footer(s, 2);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "Data Pipeline");
    const steps = [
      ["Download", "Wyscout open event and match JSON files"],
      ["Extract", "Filter shot-like events and remove penalties"],
      ["Engineer", "Distance, angle, body part, free kick, score difference"],
      ["Train", "LR and XGBoost across imbalance strategies"],
      ["Report", "Metrics, ROC curves, feature importance, LaTeX outputs"],
    ];
    for (let i = 0; i < steps.length; i++) {
      const x = 70 + i * 234;
      addPanel(s, x, 210, 210, 210);
      addText(s, String(i + 1).padStart(2, "0"), x + 18, 228, 60, 30, { fontSize: 18, bold: true, color: C.accent });
      addText(s, steps[i][0], x + 18, 270, 174, 42, { fontSize: 27, bold: true });
      addText(s, steps[i][1], x + 18, 328, 174, 72, { fontSize: 17, color: C.muted });
      if (i < steps.length - 1) addText(s, "→", x + 212, 290, 22, 40, { fontSize: 28, color: C.muted });
    }
    addText(s, "Key engineering choice: score_diff is captured before the shot outcome, avoiding target leakage.", 86, 514, 980, 42, {
      fontSize: 24,
      bold: true,
    });
    footer(s, 3);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "Dataset Snapshot");
    addMetric(s, "total shots after filtering", "45,246", 70, 190, 320, C.accent);
    addMetric(s, "overall goal rate", "~10%", 410, 190, 260);
    addMetric(s, "train / val / test", "70 / 15 / 15", 700, 190, 360, C.blue);
    addText(s, "Shots by competition", 80, 330, 300, 30, { fontSize: 22, bold: true });
    addHorizontalBars(s, competitions.map((r) => [r[0], r[1]]), 80, 375, 110, 470, 31, C.ink);
    addText(s, "Goal rate by competition", 855, 350, 260, 30, { fontSize: 22, bold: true });
    addSimpleTable(
      s,
      [["Competition", "Goal rate"], ...competitions.map((r) => [r[0], `${r[2].toFixed(1)}%`])],
      855,
      390,
      [190, 110],
      27,
      14,
    );
    footer(s, 4);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "Experiment Design");
    addText(s, "Two model families were compared under three imbalance strategies.", 76, 180, 900, 50, {
      fontSize: 30,
      bold: true,
    });
    const cols = [
      ["Models", "Logistic Regression\nXGBoost"],
      ["Imbalance handling", "None\nClass weight\nSMOTE"],
      ["Evaluation", "AUC-ROC\nAUC-PR\nF1, sensitivity, specificity\nLog-loss"],
    ];
    for (let i = 0; i < cols.length; i++) {
      const x = 80 + i * 380;
      addPanel(s, x, 278, 330, 250);
      addText(s, cols[i][0], x + 24, 304, 280, 34, { fontSize: 25, bold: true });
      addText(s, cols[i][1], x + 24, 362, 282, 126, { fontSize: 22, color: C.muted });
    }
    addText(s, "Why group by match?", 86, 590, 270, 32, { fontSize: 24, bold: true, color: C.accent });
    addText(s, "Shots from the same match never cross folds, so the test set better simulates unseen matches.", 356, 590, 760, 42, {
      fontSize: 22,
    });
    footer(s, 5);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "Model Results");
    addSimpleTable(
      s,
      [["Model", "Imbalance", "AUC", "AUC-PR", "F1", "Sens.", "Spec."], ...metrics.map((r) => [r[0], r[1], ...r.slice(2).map((v) => v.toFixed(3))])],
      62,
      190,
      [92, 150, 86, 92, 76, 86, 86],
      43,
      14,
    );
    addText(s, "Main readout", 875, 200, 230, 34, { fontSize: 26, bold: true });
    addBullet(s, "Logistic Regression slightly leads on AUC-ROC.", 875, 260, 270, { fontSize: 19, height: 62 });
    addBullet(s, "Class weighting and SMOTE improve recall but reduce specificity.", 875, 342, 290, { fontSize: 19, height: 74 });
    addBullet(s, "More complex models do not automatically win with basic xG features.", 875, 438, 280, { fontSize: 19, height: 74 });
    addText(s, "Best AUC-ROC: LR + class weight = 0.771", 82, 590, 800, 42, {
      fontSize: 28,
      bold: true,
      color: C.accent,
    });
    footer(s, 6);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "What the Model Learns");
    addHorizontalBars(s, importance, 70, 190, 130, 430, 39, C.blue);
    addText(s, "Interpretation", 820, 210, 260, 34, { fontSize: 26, bold: true });
    addBullet(s, "Shot type and geometry dominate the signal.", 820, 270, 330, { fontSize: 20, height: 58 });
    addBullet(s, "Head/body indicator is the strongest XGBoost gain feature.", 820, 350, 330, { fontSize: 20, height: 72 });
    addBullet(s, "Angle and distance remain core xG variables, matching football intuition.", 820, 448, 330, { fontSize: 20, height: 80 });
    footer(s, 7);
  }

  {
    const s = p.slides.add();
    s.background.fill = C.white;
    addSlideTitle(s, "Conclusion and Next Steps");
    addText(s, "The pipeline successfully turns raw event logs into a reproducible shot-quality model.", 76, 178, 880, 70, {
      fontSize: 32,
      bold: true,
    });
    addText(s, "Current conclusion", 86, 295, 300, 34, { fontSize: 25, bold: true, color: C.accent });
    addBullet(s, "Basic geometric features already explain most of the measurable signal.", 92, 350, 600, { fontSize: 22 });
    addBullet(s, "XGBoost does not clearly outperform the linear baseline on this feature set.", 92, 420, 650, { fontSize: 22 });
    addText(s, "Future work", 785, 295, 300, 34, { fontSize: 25, bold: true, color: C.blue });
    addBullet(s, "Add calibration analysis: Brier score and reliability curves.", 790, 350, 390, { fontSize: 21, color: C.blue });
    addBullet(s, "Tune hyperparameters on the validation fold.", 790, 420, 390, { fontSize: 21, color: C.blue });
    addBullet(s, "Add richer context: defender pressure, assist type, goalkeeper position, and pre-shot sequence.", 790, 488, 390, { fontSize: 21, height: 92, color: C.blue });
    footer(s, 8);
  }

  for (const [idx, slide] of p.slides.items.entries()) {
    const stem = `slide-${String(idx + 1).padStart(2, "0")}`;
    const png = await p.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(PREVIEW_DIR, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(LAYOUT_DIR, `${stem}.layout.json`), await layout.text());
  }
  const montage = await p.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(path.join(PREVIEW_DIR, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));

  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(OUT);
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
