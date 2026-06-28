/** Shared layout tokens — PptxGenJS LAYOUT_16x9 is 10" × 5.625". */

export const C = {
  ink: "111111",
  muted: "555555",
  light: "EDEDED",
  panel: "F4F4F4",
  rule: "B8BCC4",
  accent: "FF6B35",
  blue: "2F6F9F",
  white: "FFFFFF",
  accentSoft: "FFF0EA",
  blueSoft: "EAF2F8",
};

export const L = {
  slideW: 10,
  slideH: 5.625,
  mx: 0.45,
  my: 0.2,
  cw: 9.1,
  footerY: 5.28,
  eyebrowY: 0.18,
  titleY: 0.36,
  ruleY: 0.78,
  bodyY: 0.95,
  font: "Calibri",
};

export const metrics = [
  ["Logistic Regression", "None", 0.771, 0.329, 0.167, 0.097, 0.993, false],
  ["Logistic Regression", "Class weight", 0.771, 0.329, 0.321, 0.684, 0.718, true],
  ["Logistic Regression", "SMOTE", 0.771, 0.328, 0.321, 0.672, 0.725, false],
  ["XGBoost", "None", 0.764, 0.321, 0.170, 0.100, 0.992, false],
  ["XGBoost", "Class weight", 0.763, 0.323, 0.321, 0.673, 0.723, false],
  ["XGBoost", "SMOTE", 0.755, 0.310, 0.334, 0.333, 0.928, false],
];

export const competitions = [
  ["England", 8800, 10.6],
  ["Spain", 8428, 10.8],
  ["Italy", 9215, 9.6],
  ["Germany", 7181, 10.6],
  ["France", 8841, 10.2],
  ["World Cup", 1501, 9.0],
  ["Euro", 1280, 7.6],
];

export const importance = [
  ["Header (body part)", 16.71],
  ["Shot angle", 9.89],
  ["Foot shot", 9.56],
  ["Distance", 9.04],
  ["Free kick", 4.22],
  ["Score difference", 2.69],
  ["Pitch x", 2.51],
  ["Match minute", 2.44],
  ["Pitch y", 2.14],
];

export function textOpts(extra = {}) {
  return { fontFace: L.font, color: C.ink, ...extra };
}

/** Evenly space N columns inside content width. */
export function colLayout(n, gap = 0.12) {
  const colW = (L.cw - gap * (n - 1)) / n;
  const x = (i) => L.mx + i * (colW + gap);
  return { colW, gap, x };
}

export function addFooter(slide, label, n, total = 8) {
  slide.addShape("rect", {
    x: L.mx,
    y: L.footerY - 0.06,
    w: L.cw,
    h: 0.008,
    fill: { color: C.rule },
    line: { color: C.rule, width: 0 },
  });
  slide.addText(label, {
    x: L.mx,
    y: L.footerY,
    w: 6,
    h: 0.18,
    ...textOpts({ fontSize: 7.5, color: C.muted }),
  });
  slide.addText(`${n} / ${total}`, {
    x: L.mx + L.cw - 0.8,
    y: L.footerY,
    w: 0.8,
    h: 0.18,
    align: "right",
    ...textOpts({ fontSize: 7.5, color: C.muted }),
  });
}

export function addSlideTitle(slide, eyebrow, title) {
  slide.addText(eyebrow, {
    x: L.mx,
    y: L.eyebrowY,
    w: L.cw,
    h: 0.2,
    ...textOpts({ fontSize: 8, bold: true, color: C.muted, charSpacing: 0.5 }),
  });
  slide.addText(title, {
    x: L.mx,
    y: L.titleY,
    w: L.cw,
    h: 0.38,
    ...textOpts({ fontSize: 22, bold: true }),
  });
  slide.addShape("rect", {
    x: L.mx,
    y: L.ruleY,
    w: L.cw,
    h: 0.015,
    fill: { color: C.rule },
    line: { color: C.rule, width: 0 },
  });
}

export function addPanel(slide, x, y, w, h, fill = C.panel) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: { color: C.rule, width: 0.5 },
  });
}

export function addMetric(slide, label, value, x, y, w, color = C.ink) {
  slide.addText(value, {
    x,
    y,
    w,
    h: 0.38,
    ...textOpts({ fontSize: 22, bold: true, color }),
  });
  slide.addText(label, {
    x,
    y: y + 0.36,
    w,
    h: 0.28,
    ...textOpts({ fontSize: 8.5, color: C.muted }),
  });
}

export function addBullets(slide, items, x, y, w, opts = {}) {
  const rows = items.map((t) => ({
    text: t,
    options: {
      bullet: { code: "2022" },
      fontFace: L.font,
      fontSize: opts.fontSize || 10,
      color: opts.color || C.ink,
      breakLine: true,
      paraSpaceAfter: opts.spaceAfter ?? 4,
      lineSpacingMultiple: 1.08,
    },
  }));
  slide.addText(rows, {
    x,
    y,
    w,
    h: opts.h || 1.6,
    valign: "top",
    margin: [0, 0, 0, 0],
  });
}

export function addBarChart(slide, rows, x, y, w, h, color, seriesName = "Value") {
  slide.addChart(
    "bar",
    [{ name: seriesName, labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]) }],
    {
      x,
      y,
      w,
      h,
      barDir: "bar",
      chartColors: [color],
      showLegend: false,
      valAxisHidden: true,
      catAxisLabelFontSize: 8,
      catAxisLabelColor: C.muted,
      dataLabelFontSize: 7,
      dataLabelColor: C.muted,
      dataLabelPosition: "outEnd",
      barGapWidthPct: 35,
    },
  );
}

export function addSectionLabel(slide, text, x, y, w, color = C.ink) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.22,
    ...textOpts({ fontSize: 11, bold: true, color }),
  });
}

export function addCallout(slide, text, x, y, w, h, opts = {}) {
  addPanel(slide, x, y, w, h, opts.fill || C.accentSoft);
  slide.addText(text, {
    x: x + 0.12,
    y: y + 0.06,
    w: w - 0.24,
    h: h - 0.12,
    ...textOpts({
      fontSize: opts.fontSize || 9.5,
      bold: opts.bold ?? false,
      color: opts.color || C.accent,
      valign: "middle",
      lineSpacingMultiple: 1.1,
    }),
  });
}

export function addThreeColCards(slide, cols, y, h, opts = {}) {
  const { colW, x } = colLayout(3, opts.gap ?? 0.12);
  cols.forEach(([title, body], i) => {
    const left = x(i);
    addPanel(slide, left, y, colW, h);
    slide.addText(title, {
      x: left + 0.12,
      y: y + 0.12,
      w: colW - 0.24,
      h: 0.22,
      ...textOpts({ fontSize: opts.titleSize ?? 11, bold: true }),
    });
    slide.addShape("rect", {
      x: left + 0.12,
      y: y + 0.38,
      w: 0.35,
      h: 0.025,
      fill: { color: C.accent },
      line: { color: C.accent, width: 0 },
    });
    slide.addText(body, {
      x: left + 0.12,
      y: y + 0.48,
      w: colW - 0.24,
      h: h - 0.58,
      valign: "top",
      ...textOpts({
        fontSize: opts.bodySize ?? 9.5,
        color: C.muted,
        lineSpacingMultiple: 1.2,
      }),
    });
  });
}
