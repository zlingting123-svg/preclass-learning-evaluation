import type { SurveyQuestion } from "./questionnaires.js";
/** Conservative local recognition. Teacher must review; this is not AI output. */
export function recognizeQuestions(text: string): SurveyQuestion[] {
  const fresh = (
    title: string,
    type: SurveyQuestion["type"] = "text",
    options: string[] = [],
  ): SurveyQuestion => ({
    id: crypto.randomUUID(),
    title,
    type,
    required: false,
    options,
  });
  const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean),
    grid = lines.map((l) => l.split("\t").map((c) => c.trim()));
  const header = grid.findIndex((r) =>
    r.some((x) => /^(题目|问题|题干|question)$/i.test(x)),
  );
  if (header >= 0) {
    const h = grid[header],
      title = h.findIndex((x) => /^(题目|问题|题干|question)$/i.test(x)),
      kind = h.findIndex((x) => /^(题型|类型|type)$/i.test(x)),
      optionColumns = h
        .map((x, i) => (/^(?:选项)?[A-H]$/.test(x) ? i : -1))
        .filter((i) => i >= 0),
      combined = h.findIndex((x) => /^(选项|options)$/i.test(x));
    return grid
      .slice(header + 1)
      .filter((r) => r[title])
      .map((r) => {
        const options = optionColumns.length
          ? optionColumns.map((i) => r[i] ?? "").filter(Boolean)
          : combined >= 0
            ? (r[combined] ?? "").split(/[|｜]/).filter(Boolean)
            : [];
        const type = /多选|multiple/i.test(r[kind] ?? "")
          ? "multiple"
          : /单选|single/i.test(r[kind] ?? "") || options.length
            ? "single"
            : "text";
        return fresh(r[title], type, options);
      });
  }
  const questions: SurveyQuestion[] = [];
  for (const line of lines) {
    const q = line.match(/^(?:第?\d+[题.、．)）]|Q\d+[.:：])\s*(.+)$/i),
      o = line.match(/^[A-Ha-h][.、．)）]\s*(.+)$/);
    if (q) {
      const title = q[1];
      questions.push(
        fresh(
          title,
          /多选/.test(title)
            ? "multiple"
            : /单选/.test(title)
              ? "single"
              : "text",
        ),
      );
    } else if (o && questions.length) {
      const last = questions[questions.length - 1];
      last.options.push(o[1]);
      if (last.type === "text") last.type = "single";
    }
  }
  return questions;
}
