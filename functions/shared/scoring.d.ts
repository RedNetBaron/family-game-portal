export const TIME_ZONE: string;
export const PLACE_POINTS: number[];
export const PLAY_POINTS: number;
export const DAILY_GAME_CAP: number;
export const GAME_LABELS: Record<string, string>;

export type Placement = { name: string; score: number; place: number; points: number };
export type GameResult = { type: string; day: string; month?: string; placements: Record<string, Placement> };
export type DailyScore = { uid: string; name: string; day: string; month?: string; points: number; solved: boolean; guesses?: number; streak?: number; pattern?: string[] };
export type StandingRow = { uid: string; name: string; points: number; games: number; wins: number; place: number };

export function familyDay(ms: number): string;
export function familyMonth(ms: number): string;
export function previousDay(day: string): string;
export function previousMonth(month: string): string;
export function monthName(month: string): string;
export function placements(rows: { uid: string; name: string; score: number }[]): Record<string, Placement>;
export function dailyWordPoints(solved: boolean, guesses: number): number;
export function standings(results: GameResult[], daily: DailyScore[], board?: string): StandingRow[];
