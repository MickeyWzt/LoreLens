import type { DecipherResult } from './model';

export type ScanStage = 'home' | 'camera' | 'crop' | 'analyzing' | 'result' | 'error' | 'pending';

export interface ScanState {
  stage: ScanStage;
  image?: string;
  result?: DecipherResult;
  error?: string;
}

export type ScanEvent =
  | { type: 'OPEN_CAMERA' }
  | { type: 'CAPTURE'; image: string }
  | { type: 'START_ANALYSIS'; image: string }
  | { type: 'ANALYSIS_SUCCESS'; result: DecipherResult }
  | { type: 'SHOW_RESULT'; image?: string; result: DecipherResult }
  | { type: 'ANALYSIS_FAILURE'; error: string }
  | { type: 'QUEUE_OFFLINE' }
  | { type: 'RESET' };

export const initialScanState: ScanState = { stage: 'home' };

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'OPEN_CAMERA':
      return { stage: 'camera' };
    case 'CAPTURE':
      return { stage: 'crop', image: event.image };
    case 'START_ANALYSIS':
      return { stage: 'analyzing', image: event.image };
    case 'ANALYSIS_SUCCESS':
      return { stage: 'result', image: state.image, result: event.result };
    case 'SHOW_RESULT':
      return { stage: 'result', image: event.image, result: event.result };
    case 'ANALYSIS_FAILURE':
      return { stage: 'error', image: state.image, error: event.error };
    case 'QUEUE_OFFLINE':
      return { stage: 'pending', image: state.image };
    case 'RESET':
      return initialScanState;
  }
}
