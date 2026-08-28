import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { candidateContentHash } from "../lib/candidate-envelope";
import {
  sessionEditCandidateRequestFromArgs,
  sessionRenameRequestFromArgs,
} from "../lib/command-requests";
import { scoreCandidateTrap } from "../lib/trap-quality";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { handleToolCall } from "../mcp/server";
import { toolDefinitions } from "../mcp/tools";
import { webBrowserCommand, webServerOptionsFromArgs } from "../web/server";
import { runCli, tempHome, tempProjectDir } from "./helpers";

describe("session editing primitives", () => {
  test("renames a closed session while keeping every derived document in sync", () => {
    const project = tempProjectDir("codetrap-session-rename-", { realpath: true });
    const store = new SessionStore(project);
    const started = store.startSession({ goal: "Original session goal" }, new Date("2026-08-27T01:00:00.000Z"));
    store.addNote({ text: "Keep this timeline note exactly as it was written." }, new Date("2026-08-27T01:01:00.000Z"));
    store.closeSession(started.id, false, new Date("2026-08-27T01:02:00.000Z"));

    const renamed = store.updateSessionGoal(started.id, "中文会话名称", new Date("2026-08-27T01:03:00.000Z"));
    const dir = join(project, ".codetrap", "sessions");
    const session = JSON.parse(readFileSync(join(dir, started.id, "session.json"), "utf-8"));
    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf-8"));
    const notes = readFileSync(join(dir, started.id, "implementation-notes.md"), "utf-8");
    const recap = readFileSync(join(dir, started.id, "recap.md"), "utf-8");

    expect(renamed).toMatchObject({ previous_goal: "Original session goal", session: { id: started.id, goal: "中文会话名称" } });
    expect(session.goal).toBe("中文会话名称");
    expect(index.sessions[0].goal).toBe("中文会话名称");
    expect(notes).toContain("# Implementation Notes: 中文会话名称");
    expect(notes).toContain("Keep this timeline note exactly as it was written.");
    expect(recap).toContain("# Session Recap: 中文会话名称");
  });

  test("parses agent-friendly rename and partial candidate-edit requests", () => {
    expect(sessionRenameRequestFromArgs(["session-1", "新的", "会话名称"], {})).toEqual({
      sessionId: "session-1",
      goal: "新的 会话名称",
    });
    expect(sessionEditCandidateRequestFromArgs(["cand-001"], {
      session: "session-1",
      "edit-json": JSON.stringify({ title: "中文标题", fix: "必须先验证再保存。" }),
    })).toEqual({
      candidateId: "cand-001",
      sessionId: "session-1",
      edit: { title: "中文标题", fix: "必须先验证再保存。" },
    });
  });

  test("CLI exposes session rename and revisioned candidate edit end to end", () => {
    const home = tempHome("codetrap-cli-edit-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-cli-edit-", { realpath: true });
    const started = runCli(["session", "start", "CLI edit workflow", "--json"], project, home);
    expect(started.exitCode).toBe(0);
    const sessionId = JSON.parse(started.stdout).id;
    const captured = runCli([
      "session", "capture", "--trap-json", JSON.stringify(lesson("CLI candidate")), "--json",
    ], project, home);
    expect(captured.exitCode).toBe(0);
    const candidateId = JSON.parse(captured.stdout).candidate_id;

    const edited = runCli([
      "session", "edit", candidateId, "--session", sessionId,
      "--edit-json", JSON.stringify({ title: "CLI 中文候选", fix: "必须先验证再保存，确保修订记录保持一致。" }),
      "--json",
    ], project, home);
    expect(edited.exitCode).toBe(0);
    expect(JSON.parse(edited.stdout)).toMatchObject({
      success: true,
      session_id: sessionId,
      candidate: { id: candidateId, revision: 2, trap: { title: "CLI 中文候选" } },
    });

    const renamed = runCli([
      "session", "rename", sessionId, "CLI 中文会话", "--json",
    ], project, home);
    expect(renamed.exitCode).toBe(0);
    expect(JSON.parse(renamed.stdout)).toMatchObject({ session: { id: sessionId, goal: "CLI 中文会话" } });
  });

  test("MCP edits a candidate through the revisioned store and updates a stable session goal", async () => {
    const home = tempHome("codetrap-mcp-edit-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-mcp-edit-", { realpath: true });
    const trapStore = new TrapStore(project, undefined, home);
    const traps = new TrapOperations(trapStore);
    const sessions = new SessionOperations(new SessionStore(project), traps);
    const started = sessions.startSession({ goal: "Translate this session" });
    const captured = sessions.captureCandidate({
      trap: lesson("English candidate title"),
      relatedFiles: ["src/web/client.ts"],
    });
    if (captured.suppressed) throw new Error("Fixture candidate was unexpectedly suppressed.");

    const editedResult = await handleToolCall(trapStore, "edit_candidate", {
      cwd: project,
      session_id: started.id,
      candidate_id: captured.candidate.id,
      title: "中文候选标题",
      context: "在 Windows 上启动本地网页控制台时，系统浏览器进程可能持续等待。",
      mistake: "代理直接等待浏览器子进程结束，导致整个命令无法及时返回。",
      fix: "应该异步启动浏览器，并确保主服务不等待浏览器进程退出。",
    });
    const editedPayload = JSON.parse((editedResult.content[0] as { text: string }).text);
    const stored = sessions.getCandidate(captured.candidate.id, started.id).candidate;
    expect(editedPayload).toMatchObject({ success: true, revision: 2, candidate_id: captured.candidate.id });
    expect(stored.trap.title).toBe("中文候选标题");
    expect(stored.content_hash).toBe(candidateContentHash(stored));

    const renamedResult = await handleToolCall(trapStore, "update_session_goal", {
      cwd: project,
      session_id: started.id,
      goal: "中文会话目标",
    });
    expect(JSON.parse((renamedResult.content[0] as { text: string }).text)).toMatchObject({
      success: true,
      previous_goal: "Translate this session",
      session: { id: started.id, goal: "中文会话目标" },
    });
    expect(toolDefinitions.map((tool) => tool.name)).toEqual(expect.arrayContaining(["edit_candidate", "update_session_goal"]));
  });
});

describe("multilingual candidate quality", () => {
  test("equivalent English and Chinese lessons receive equivalent high scores", () => {
    const english = scoreCandidateTrap({
      trap: lesson("Browser launch must not block the local web server"),
      evidence: [{ source_type: "conversation", related_files: ["src/web/server.ts"] }],
    } as never);
    const chinese = scoreCandidateTrap({
      trap: {
        ...lesson("启动浏览器时不能阻塞本地网页服务"),
        context: "在 Windows 上启动本地网页控制台时，系统浏览器进程可能持续等待。",
        mistake: "代理直接等待浏览器子进程结束，导致整个服务无法及时启动。",
        fix: "应该异步启动浏览器，并确保主服务不等待浏览器进程退出。",
      },
      evidence: [{ source_type: "conversation", related_files: ["src/web/server.ts"] }],
    } as never);

    expect(chinese.score).toBe(english.score);
    expect(chinese.score).toBeGreaterThanOrEqual(0.9);
    expect(chinese.quality.warnings).toEqual([]);
  });
});

describe("web launch ergonomics", () => {
  test("parses --open and builds platform-safe launcher commands", () => {
    expect(webServerOptionsFromArgs(["--open"], "C:\\project").open).toBe(true);
    expect(webBrowserCommand("http://127.0.0.1:4737/?token=abc", "win32")).toEqual([
      "cmd.exe", "/d", "/s", "/c", "start", "", "http://127.0.0.1:4737/?token=abc",
    ]);
    expect(webBrowserCommand("http://localhost", "darwin")).toEqual(["open", "http://localhost"]);
    expect(webBrowserCommand("http://localhost", "linux")).toEqual(["xdg-open", "http://localhost"]);
  });
});

function lesson(title: string) {
  return {
    title,
    category: "other",
    scope: "project",
    context: "When launching the local web console on Windows, a system browser process can keep waiting indefinitely.",
    mistake: "The agent waits for the browser child process and prevents the web server command from returning promptly.",
    fix: "Use a detached asynchronous browser launch and verify that the web server does not wait for the browser process.",
    severity: "warning",
    tags: ["web", "windows", "browser"],
    path_globs: ["src/web/**"],
    module: "web",
    owner: null,
    before_code: null,
    after_code: null,
  };
}
