/// <reference lib="webworker" />

import {
  STOCKFISH_ENGINE_ASSETS,
  createStockfishWorkerRuntime,
  type WorkerCommand,
} from './stockfishWorkerRuntime';

const scope = self as DedicatedWorkerGlobalScope;

scope.postMessage({
  type: 'worker_booted',
  timestamp: new Date().toISOString(),
});

const runtime = createStockfishWorkerRuntime((msg) => scope.postMessage(msg), {
  WorkerCtor: Worker,
  console,
  engineAssets: STOCKFISH_ENGINE_ASSETS,
  fetch: scope.fetch.bind(scope),
  now: () => performance.now(),
});

scope.onmessage = (event: MessageEvent<WorkerCommand>) => {
  runtime.handleCommand(event.data);
};

runtime.init();
