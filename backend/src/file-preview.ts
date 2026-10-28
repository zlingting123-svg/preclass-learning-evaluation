import * as XLSX from "xlsx";
import WordExtractor from "word-extractor";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { ensure } from "./errors.js";
import type { FilePreview } from "../../shared/questionnaires.js";

export async function previewFile(raw: unknown): Promise<FilePreview> {
  const { name, base64 } = z
    .object({
      name: z.string().min(1).max(250),
      base64: z
        .string()
        .min(1)
        .max(1400000)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/),
    })
    .strict()
    .parse(raw);
  const buffer = Buffer.from(base64, "base64");
  ensure(
    buffer.length <= 1024 * 1024,
    413,
    "FILE_TOO_LARGE",
    "文件不能超过1MB，请拆分",
  );
  const ext = name.toLowerCase().split(".").pop();
  ensure(
    ["csv", "xlsx", "xls", "docx", "doc"].includes(ext ?? ""),
    400,
    "FILE_TYPE",
    "支持 CSV、XLSX、XLS、DOCX、DOC",
  );
  const zip = buffer.subarray(0, 2).toString() === "PK",
    ole = buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1";
  if (zip) {
    // Bound ZIP expansion before handing Office content to third-party parsers.
    let expanded = 0,
      entries = 0;
    for (let p = 0; p + 46 <= buffer.length; p++)
      if (buffer.readUInt32LE(p) === 0x02014b50) {
        expanded += buffer.readUInt32LE(p + 24);
        entries++;
        ensure(
          expanded <= 8 * 1024 * 1024 && entries <= 1000,
          400,
          "FILE_TOO_LARGE",
          "Office 解压内容过大，请拆分",
        );
        p +=
          45 +
          buffer.readUInt16LE(p + 28) +
          buffer.readUInt16LE(p + 30) +
          buffer.readUInt16LE(p + 32);
      }
    ensure(entries > 0, 400, "FILE_PARSE_FAILED", "Office 压缩目录无效");
  }
  try {
    if (ext === "docx" || ext === "doc") {
      ensure(
        ext === "docx" ? zip : ole,
        400,
        "FILE_TYPE",
        "文件内容与扩展名不符",
      );
      const text = (await new WordExtractor().extract(buffer)).getBody();
      ensure(text.length <= 300000, 400, "FILE_TOO_LARGE", "文档内容过长");
      const rows = text
        .split(/\r?\n/)
        .filter((x) => x.trim())
        .map((x) => x.split(/\t| {2,}|\u0007/).map((x) => x.trim()));
      ensure(
        rows.length <= 1002,
        400,
        "TOO_MANY_ROWS",
        "文档超过1000行，请拆分文件",
      );
      return {
        format: ext,
        sheets: [{ name: "文档文本", rows }],
        text,
        warnings: [
          "Word 内容按文本/制表符识别；合并单元格或复杂排版请检查并调整字段，不能直接确认错误结果。",
        ],
      };
    }
    if (ext === "csv") {
      ensure(
        !zip && !ole && !buffer.includes(0),
        400,
        "FILE_TYPE",
        "CSV 内容格式无效",
      );
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      const rows = parse(text, {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
        max_record_size: 100000,
      }) as string[][];
      ensure(
        rows.length <= 1002,
        400,
        "TOO_MANY_ROWS",
        "最多1000名学生，请拆分文件",
      );
      return {
        format: "csv",
        sheets: [{ name: "CSV", rows }],
        text,
        warnings: [],
      };
    }
    ensure(
      ext === "xlsx" ? zip : ole,
      400,
      "FILE_TYPE",
      "文件内容与扩展名不符",
    );
    const book = XLSX.read(buffer, {
      type: "buffer",
      sheetRows: 1003,
      cellFormula: false,
      cellHTML: false,
    });
    const sheets = book.SheetNames.slice(0, 10).map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<string[]>(book.Sheets[name], {
        header: 1,
        raw: false,
        defval: "",
      }),
    }));
    ensure(
      sheets.every((s) => s.rows.length <= 1002),
      400,
      "TOO_MANY_ROWS",
      "表格超过1000行，请拆分文件",
    );
    return {
      format: ext!,
      sheets,
      text: sheets
        .map((s) => s.rows.map((r) => r.join("\t")).join("\n"))
        .join("\n"),
      warnings: [
        "Excel 使用显示文本，已损失的学号前导零不能自动恢复，请核对原文件。",
      ],
    };
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    ensure(
      false,
      400,
      "FILE_PARSE_FAILED",
      "文件无法识别，可能已损坏、加密或编码不支持；请转为 UTF-8 CSV 或重新保存 Office 文件",
    );
  }
}
