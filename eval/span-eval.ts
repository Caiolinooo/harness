/**
 * Span-level eval harness: tool selection accuracy + adherence flags.
 * Usage: pnpm exec tsx eval/span-eval.ts .harness/runs/<runId>/spans/spans.jsonl
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx eval/span-eval.ts <spans.jsonl>");
  process.exit(1);
}

const lines = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as {
    kind: string;
    status: string;
    attributes?: { schemaPass?: boolean; adherenceViolation?: boolean };
    durationMs?: number;
  });

const tools = lines.filter((s) => s.kind === "tool");
const passes = tools.filter((t) => t.attributes?.schemaPass === true).length;
const fails = tools.filter((t) => t.attributes?.schemaPass === false).length;
const llm = lines.filter((s) => s.kind === "llm").length;
const adherence = lines.filter(
  (s) => s.attributes?.adherenceViolation === true,
).length;
const totalMs = lines.reduce((a, s) => a + (s.durationMs ?? 0), 0);

const accuracy = tools.length ? passes / tools.length : 1;
console.log(
  JSON.stringify(
    {
      spans: lines.length,
      llmCalls: llm,
      toolCalls: tools.length,
      toolSchemaPasses: passes,
      toolSchemaFails: fails,
      toolSelectionAccuracy: Number(accuracy.toFixed(4)),
      adherenceFlags: adherence,
      totalDurationMs: totalMs,
    },
    null,
    2,
  ),
);
