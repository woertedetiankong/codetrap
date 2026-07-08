import { describe, expect, test } from "bun:test";
import { OllamaEmbedder } from "../lib/embedder";

describe("OllamaEmbedder", () => {
  test("calls Ollama /api/embed with batch input and dimensions", async () => {
    let capturedUrl = "";
    let capturedBody: unknown;
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        embeddings: [
          [1, 0, 0],
          [0, 1, 0],
        ],
      }));
    };

    const embedder = new OllamaEmbedder({
      endpoint: "http://127.0.0.1:11434/",
      model: "qwen3-embedding:0.6b",
      dimensions: 3,
      fetch: fetcher,
    });

    const embeddings = await embedder.embed(["first", "second"], "retrieval.passage");

    expect(capturedUrl).toBe("http://127.0.0.1:11434/api/embed");
    expect(capturedBody).toEqual({
      model: "qwen3-embedding:0.6b",
      input: ["first", "second"],
      dimensions: 3,
      truncate: true,
    });
    expect(embeddings).toHaveLength(2);
    expect(Array.from(embeddings[0])).toEqual([1, 0, 0]);
    expect(Array.from(embeddings[1])).toEqual([0, 1, 0]);
  });

  test("prepends the qwen3 retrieval instruction to queries but not passages", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ embeddings: [[1, 0, 0]] }));
    };
    const embedder = new OllamaEmbedder({ model: "qwen3-embedding:0.6b", dimensions: 3, fetch: fetcher });

    await embedder.embed(["how do I fix the bug"], "retrieval.query");
    await embedder.embed(["how do I fix the bug"], "retrieval.passage");

    expect((bodies[0]!.input as string[])[0]).toBe(
      "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: how do I fix the bug"
    );
    expect((bodies[1]!.input as string[])[0]).toBe("how do I fix the bug");
  });

  test("leaves queries unmodified for non-qwen3 models", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ embeddings: [[1, 0, 0]] }));
    };
    const embedder = new OllamaEmbedder({ model: "embeddinggemma", dimensions: 3, fetch: fetcher });

    await embedder.embed(["plain query"], "retrieval.query");

    expect((capturedBody.input as string[])[0]).toBe("plain query");
  });

  test("passes an abort signal so a wedged server cannot hang search forever", async () => {
    let capturedSignal: AbortSignal | null | undefined;
    const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return new Response(JSON.stringify({ embeddings: [[1, 0, 0]] }));
    };
    const embedder = new OllamaEmbedder({ dimensions: 3, fetch: fetcher });

    await embedder.embed(["text"], "retrieval.query");
    expect(capturedSignal).toBeInstanceOf(AbortSignal);

    await embedder.health();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  test("maps fetch timeouts to a readable error", async () => {
    const fetcher = async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    };
    const embedder = new OllamaEmbedder({ endpoint: "http://127.0.0.1:11434", dimensions: 3, fetch: fetcher });

    await expect(embedder.embed(["text"], "retrieval.query")).rejects.toThrow(
      "Ollama embeddings request timed out after 10s at http://127.0.0.1:11434."
    );
  });

  test("rejects unexpected embedding dimensions", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      embeddings: [[1, 0]],
    }));
    const embedder = new OllamaEmbedder({ dimensions: 3, fetch: fetcher });

    await expect(embedder.embed(["text"], "retrieval.query")).rejects.toThrow(
      "Ollama embeddings returned 2 dimensions, expected 3."
    );
  });

  test("surfaces Ollama HTTP errors", async () => {
    const fetcher = async () => new Response("model not found", { status: 404 });
    const embedder = new OllamaEmbedder({ fetch: fetcher });

    await expect(embedder.embed(["text"], "retrieval.query")).rejects.toThrow(
      "Ollama embeddings request failed (404): model not found"
    );
  });

  test("health checks whether the configured model is installed", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      models: [{ name: "qwen3-embedding:0.6b" }],
    }));
    const embedder = new OllamaEmbedder({
      model: "qwen3-embedding:0.6b",
      fetch: fetcher,
    });

    expect(await embedder.health()).toEqual({ ok: true });
  });

  test("health suggests pulling a missing Ollama model", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      models: [{ name: "embeddinggemma" }],
    }));
    const embedder = new OllamaEmbedder({
      model: "qwen3-embedding:0.6b",
      fetch: fetcher,
    });

    expect(await embedder.health()).toEqual({
      ok: false,
      message: "Ollama model qwen3-embedding:0.6b is not installed.",
      command: "ollama pull qwen3-embedding:0.6b",
    });
  });
});
