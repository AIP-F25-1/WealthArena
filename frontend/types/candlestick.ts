export interface CandleData {
  time: string;
  timestamp?: number; // Optional for compatibility
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number; // Optional for compatibility
}
