import { describe, expect, test } from "bun:test";
import { WEB_TEXT, WEB_TEXT_JSON } from "../web/client-text";
import { WEB_INDEX_HTML } from "../web/static";

describe("web client text", () => {
  test("keeps locale dictionaries aligned and embeds them into the web shell", () => {
    expect(Object.keys(WEB_TEXT.zh).sort()).toEqual(Object.keys(WEB_TEXT.en).sort());
    expect(JSON.parse(WEB_TEXT_JSON)).toEqual(WEB_TEXT);
    expect(WEB_INDEX_HTML).toContain("\"action.deleteSession\"");
    expect(WEB_INDEX_HTML).toContain("data-delete-session");
  });
});
