/// <reference lib="webworker" />

import {
  CDN_ENGINE,
  CDN_WASM,
  LOCAL_ENGINE,
  READY_FALLBACK_MS,
  createStockfishWorkerRuntime,
  type WorkerCommand,
} from './stockfishWorkerRuntime';

const scope = self as DedicatedWorkerGlobalScope;

const runtime = createStockfishWorkerRuntime((msg) => scope.postMessage(msg), {
  WorkerCtor: Worker,
  BlobCtor: Blob,
  URLApi: URL,
  setTimeout: (handler, timeout) => scope.setTimeout(handler, timeout),
  clearTimeout: (id) => scope.clearTimeout(id),
  console,
  localEngine: LOCAL_ENGINE,
  cdnEngine: CDN_ENGINE,
  cdnWasm: CDN_WASM,
  readyFallbackMs: READY_FALLBACK_MS,
});

scope.onmessage = (event: MessageEvent<WorkerCommand>) => {
  runtime.handleCommand(event.data);
};

runtime.init();
