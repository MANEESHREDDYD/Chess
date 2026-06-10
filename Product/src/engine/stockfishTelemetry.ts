export type StockfishBootPhase =
  | 'worker_constructing'
  | 'worker_constructed'
  | 'worker_booted'
  | 'stockfish_script_loading'
  | 'stockfish_script_loaded'
  | 'stockfish_runtime_ready'
  | 'uci_sent'
  | 'uciok_received'
  | 'isready_sent'
  | 'readyok_received'
  | 'first_search_started'
  | 'first_bestmove_received'
  | 'boot_failed';

export type StockfishEnvironment = 'dev' | 'build' | 'preview' | 'test' | 'unknown';

export interface StockfishBootEvent {
  phase: StockfishBootPhase;
  elapsed_ms: number;
  timestamp: string;
  worker_url?: string;
  worker_source_kind?: string;
  environment?: StockfishEnvironment;
  user_agent?: string;
  message?: string;
  raw?: string;
  wasm_path?: string;
  wasm_reached?: boolean;
  wasm_content_type?: string | null;
  uciok_seen?: boolean;
  readyok_seen?: boolean;
  request_id?: number | null;
}

export interface StockfishBootFlags {
  worker_booted_seen: boolean;
  stockfish_script_loaded_seen: boolean;
  wasm_path_reached: boolean;
  uciok_seen: boolean;
  readyok_seen: boolean;
  first_search_started: boolean;
  first_bestmove_received: boolean;
}

export const STOCKFISH_BOOT_TIMEOUTS_MS: Record<
  'worker_booted' | 'stockfish_script_loaded' | 'uciok_received' | 'readyok_received' | 'first_bestmove_received',
  number
> = {
  worker_booted: 3000,
  stockfish_script_loaded: 10000,
  uciok_received: 10000,
  readyok_received: 10000,
  first_bestmove_received: 15000,
};

export const STOCKFISH_BOOT_TIMEOUT_CODES: Record<
  keyof typeof STOCKFISH_BOOT_TIMEOUTS_MS,
  'WORKER_SCRIPT_TIMEOUT' | 'STOCKFISH_ASSET_LOAD_TIMEOUT' | 'UCI_OK_TIMEOUT' | 'READY_OK_TIMEOUT' | 'FIRST_SEARCH_TIMEOUT'
> = {
  worker_booted: 'WORKER_SCRIPT_TIMEOUT',
  stockfish_script_loaded: 'STOCKFISH_ASSET_LOAD_TIMEOUT',
  uciok_received: 'UCI_OK_TIMEOUT',
  readyok_received: 'READY_OK_TIMEOUT',
  first_bestmove_received: 'FIRST_SEARCH_TIMEOUT',
};
