import { callable } from "@decky/api";

export interface Item {
  type: "song" | "album" | "playlist" | "artist";
  id: string;
  title: string;
  subtitle?: string;
  thumb?: string | null;
  album?: string | null;
  durationMs?: number;
  autoplay?: boolean;
}

export interface State {
  playing: boolean;
  song: Item | null;
  liked: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  shuffle: boolean;
  repeat: "OFF" | "ALL" | "ONE";
  index: number;
  queue: Item[];
  error: string | null;
  sleepEndsAt: number | null;
  sleepEndOfTrack: boolean;
  account: string | null;
  login: string | null;
  downloaded: boolean;
  offline?: boolean;
}

export interface Lyrics {
  songId: string | null;
  loading?: boolean;
  plain?: string | null;
  lines?: { t: number; text: string }[] | null;
}

export interface Section { title: string; items: Item[] }

export const request = callable<[method: string, path: string, body?: unknown], any>("request");
export const status = callable<[], { running: boolean; installed: boolean }>("status");
export const start = callable<[], boolean>("start");
export const stop = callable<[], boolean>("stop");

export const get = <T,>(path: string): Promise<T> => request("GET", path);
export const cmd = (op: string, value?: unknown) => request("POST", "/cmd", { op, value });
export const play = (body: { songs?: Item[]; index?: number; type?: string; id?: string; shuffle?: boolean; radio?: boolean }) =>
  request("POST", "/play", body);
export const finishLogin = () => request("POST", "/login/finish");
/** A sign-in that is waiting on the browser (not finished, not failed). */
export const signingIn = (s: State) => !!s.login && !/^(Signed in|Error)/.test(s.login);
export const logout = () => request("POST", "/logout");

/** YouTube serves any size from the same URL; the small search-result thumbs look mushy on the Deck. */
export const bigThumb = (url?: string | null, size = 544) =>
  url ? url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`) : undefined;

export const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The synced line being sung at [positionMs]. */
export const currentLine = (lyrics: Lyrics | null, positionMs: number) => {
  const lines = lyrics?.lines;
  if (!lines?.length) return -1;
  let i = -1;
  for (let k = 0; k < lines.length && lines[k].t <= positionMs + 300; k++) i = k;
  return i;
};
