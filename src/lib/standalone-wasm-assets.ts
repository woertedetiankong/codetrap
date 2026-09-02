import wasmPath from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm" with { type: "file" };

export type EmbeddedStandaloneWasmRuntime = {
  binary: ArrayBuffer;
};

let embeddedRuntimePromise: Promise<EmbeddedStandaloneWasmRuntime> | null = null;

/** Load ONNX Runtime assets embedded by Bun into a standalone executable. */
export function embeddedStandaloneWasmRuntime(): Promise<EmbeddedStandaloneWasmRuntime> {
  if (!embeddedRuntimePromise) {
    embeddedRuntimePromise = Bun.file(wasmPath).arrayBuffer().then((binary) => ({ binary })).catch((error) => {
      embeddedRuntimePromise = null;
      throw error;
    });
  }
  return embeddedRuntimePromise;
}
