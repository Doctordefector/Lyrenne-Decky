import { useEffect, useState } from "react";
import { get, Lyrics, State } from "./api";

/** Player state, polled while the component is mounted. */
export function usePlayer(intervalMs = 1000) {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const s = await get<State>("/state");
      if (alive) setState(s);
    };
    poll();
    const id = setInterval(poll, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
  return { state, refresh: () => get<State>("/state").then(setState) };
}

/** Lyrics for the current song; re-asks while the daemon is still looking them up. */
export function useLyrics(songId: string | undefined) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  useEffect(() => {
    if (!songId) return setLyrics(null);
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async (tries: number) => {
      const l = await get<Lyrics>("/lyrics");
      if (!alive) return;
      setLyrics(l);
      if ((l.loading || l.songId !== songId) && tries < 20) timer = setTimeout(() => load(tries + 1), 1500);
    };
    load(0);
    return () => { alive = false; clearTimeout(timer); };
  }, [songId]);
  return lyrics;
}
