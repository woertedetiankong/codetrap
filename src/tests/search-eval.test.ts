import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import type { TrapInput } from "../domain/trap";
import type { SearchMode } from "../lib/constants";
import type { EmbeddingProvider, EmbeddingTask } from "../lib/embedder";

type EvalFixture = {
  traps: TrapInput[];
  queries: {
    query: string;
    mode: SearchMode;
    goldTrapIds: number[];
    phaseGate: "phase0" | "phase1" | "phase4";
    minRecallAt3?: number;
    minRecallAt5: number;
  }[];
};

class EvalEmbedder implements EmbeddingProvider {
  readonly provider = "eval";
  readonly model = "eval-embedding";
  readonly dimensions = 14;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(vectorFor);
  }
}

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/search-eval.json", import.meta.url), "utf-8")
) as EvalFixture;

describe("search evaluation fixture", () => {
  test("meets Recall@5 gates for the implemented retrieval phases", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new EvalEmbedder());
    for (const trap of fixture.traps) {
      repo.add(trap);
    }
    await repo.ensureEmbeddings();

    for (const item of fixture.queries) {
      const results = await repo.search(item.query, { mode: item.mode, limit: 5 });
      const resultIdsAt5 = new Set(results.map((result) => result.trap.id));
      const hits = item.goldTrapIds.filter((id) => resultIdsAt5.has(id)).length;
      const recallAt5 = hits / item.goldTrapIds.length;
      expect(recallAt5, `${item.phaseGate}: ${item.query}`).toBeGreaterThanOrEqual(item.minRecallAt5);

      if (item.minRecallAt3 !== undefined) {
        const resultIdsAt3 = new Set(results.slice(0, 3).map((result) => result.trap.id));
        const hitsAt3 = item.goldTrapIds.filter((id) => resultIdsAt3.has(id)).length;
        const recallAt3 = hitsAt3 / item.goldTrapIds.length;
        expect(recallAt3, `${item.phaseGate}: ${item.query}`).toBeGreaterThanOrEqual(item.minRecallAt3);
      }
    }
  });
});

function vectorFor(text: string): Float32Array {
  const lower = text.toLowerCase();
  const vector = new Float32Array(14);
  if (/(http|https|fetch|axios|request|api|remote|network|网络|请求)/.test(lower)) vector[0] = 1;
  if (/(auth|authentication|login|session|认证)/.test(lower)) vector[1] = 1;
  if (/(db|database|sqlite|sql|migration|schema|table|数据库)/.test(lower)) vector[2] = 1;
  if (/(config|env|environment|process\.env|配置)/.test(lower)) vector[3] = 1;
  if (/(cache|redis|stale|缓存)/.test(lower)) vector[4] = 1;
  if (/(cli|flag|parseargs|query text|positionals)/.test(lower)) vector[5] = 1;
  if (/(sticks3|esp-idf|esp32p4|hello_world|flash|target|8mb|idf)/.test(lower)) vector[6] = 1;
  if (/(m5unified|button|buttons|按键|按钮|screen|display|lcd|屏幕|兼容)/.test(lower)) vector[7] = 1;
  if (/(pmic|i2c|st7789|power|电源|屏幕不亮|backlight)/.test(lower)) vector[8] = 1;
  if (/(asr|豆包|voice|语音|firmware|固件|mac代理|agent-side)/.test(lower)) vector[9] = 1;
  if (/(voice_server_uri|localhost|127\.0\.0\.1|websocket|局域网|lan)/.test(lower)) vector[10] = 1;
  if (/(es8311|0x18|7-bit|8-bit|codec|probe|地址)/.test(lower)) vector[11] = 1;
  if (/(gpio14|gpio16|i2s|din|wav|全 0|zeros|speaker dout)/.test(lower)) vector[12] = 1;
  if (/(peak|32768|gain|quality|asr_timing|增益|重刷)/.test(lower)) vector[13] = 1;
  if (vector.every((value) => value === 0)) vector[5] = 1;
  return vector;
}
