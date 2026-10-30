import { ConfirmModal, DialogButton, Dropdown, Focusable, Navigation, showModal, SteamSpinner, Tabs, TextField } from "@decky/ui";
import { createContext, CSSProperties, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { bigThumb, cmd, currentLine, fmt, get, Item, play, Section } from "./api";
import { usePlayer, useLyrics } from "./hooks";

export const ROUTE = "/lyrenne";
let initialTab = "home";

/** Opens the full-screen page over whatever is running; the game keeps going underneath. */
export function openPage(tab: string) {
  initialTab = tab;
  Navigation.Navigate(ROUTE);
  Navigation.CloseSideMenus();
}

type Open = { type: string; id: string; title: string };

/** The playing song's id, plus a way to claim it on tap before the daemon has caught up. */
const Playing = createContext<{ id?: string; claim: (id: string) => void }>({ claim: () => {} });

const rowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "6px 10px", borderRadius: 6, marginBottom: 2,
};

// Steam's gamepad UI only rings focus on its own controls, so rows style their own focus.
const PAGE = 50;
const ROW_CSS = `.lyr-row.gpfocus { background: rgba(255,255,255,0.10); }`;

function Row({ item, active, selected, onActivate, onSecondary, secondaryLabel, onOptions, optionsLabel }: {
  item: Item; active?: boolean; selected?: boolean; onActivate: () => void;
  onSecondary?: () => void; secondaryLabel?: string; onOptions?: () => void; optionsLabel?: string;
}) {
  const [flash, setFlash] = useState(false);
  const last = useRef(0);
  // A touch tap can fire both onClick and onActivate; acting twice restarted the song.
  const activate = () => {
    if (Date.now() - last.current < 400) return;
    last.current = Date.now();
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    onActivate();
  };
  return (
    <Focusable
      className="lyr-row"
      style={{
        ...rowStyle,
        transition: flash ? "none" : "background 0.4s",
        background: flash ? "rgba(100,170,255,0.40)" : active ? "rgba(100,170,255,0.18)" : undefined,
      }}
      focusClassName="gpfocus"
      onActivate={activate}
      onClick={activate}
      onSecondaryButton={onSecondary}
      onSecondaryActionDescription={onSecondary ? secondaryLabel : undefined}
      onOptionsButton={onOptions}
      onOptionsActionDescription={onOptions ? optionsLabel : undefined}
    >
      {selected !== undefined && (
        <div style={{
          width: 22, height: 22, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid rgba(255,255,255,0.5)", background: selected ? "#1a9fff" : undefined, fontSize: 14,
        }}>{selected ? "✓" : ""}</div>
      )}
      {item.thumb
        ? <img src={bigThumb(item.thumb, 120)} loading="lazy" decoding="async" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: item.type === "artist" ? 24 : 4 }} />
        : <div style={{ width: 48, height: 48 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: active ? "bold" : undefined }}>{item.title}</div>
        <div style={{ opacity: 0.6, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[item.type !== "song" && `${item.type[0].toUpperCase()}${item.type.slice(1)}`, item.subtitle]
            .filter((part, k, all) => part && all.indexOf(part) === k).join(" · ")}
        </div>
      </div>
      {!!item.durationMs && <div style={{ opacity: 0.6, fontSize: 13 }}>{fmt(item.durationMs)}</div>}
    </Focusable>
  );
}

/** A list where songs play the list from that point and everything else opens. */
function Items({ items, onOpen, selection, onToggle }: {
  items: Item[]; onOpen: (o: Open) => void; selection?: Set<string>; onToggle?: (id: string) => void;
}) {
  const songs = items.filter((i) => i.type === "song");
  const playing = useContext(Playing);
  // 863 liked songs as rows at once made the page slow to open and to scroll; grow as you go.
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setShown(PAGE), [items]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setShown((n) => n + PAGE); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, items]);
  return (
    <>
      {items.slice(0, shown).map((item, k) => (
        <Row
          key={`${item.id}-${k}`}
          item={item}
          active={item.type === "song" && item.id === playing.id}
          selected={selection && item.type === "song" ? selection.has(item.id) : undefined}
          onActivate={() => {
            if (selection && onToggle) return onToggle(item.id);
            if (item.type !== "song") return onOpen({ type: item.type, id: item.id, title: item.title });
            playing.claim(item.id);
            play({ songs, index: songs.indexOf(item) });
          }}
          onSecondary={item.type === "song" ? () => cmd("playNext", item) : () => play({ type: item.type, id: item.id })}
          secondaryLabel={item.type === "song" ? "Play next" : "Play all"}
          onOptions={item.type === "song" ? () => cmd("enqueue", item) : undefined}
          optionsLabel="Add to queue"
        />
      ))}
      {shown < items.length && <div ref={sentinel} style={{ height: 1 }} />}
    </>
  );
}

// Last good answer per path: a revisit shows it at once and refreshes underneath.
// ponytail: unbounded, but it only ever holds the pages someone opened this session
const loaded = new Map<string, unknown>();

function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(path ? (loaded.get(path) as T) ?? null : null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setData((loaded.get(path) as T) ?? null); setError(null);
    get<any>(path).then((r) => {
      if (!alive) return;
      if (r?.error) { if (!loaded.has(path)) setError(r.offline ? "Lyrenne is not running." : r.error); return; }
      loaded.set(path, r);
      setData(r);
    });
    return () => { alive = false; };
  }, [path, attempt]);
  return { data, error, retry: () => setAttempt((a) => a + 1) };
}

const Loading = ({ error, retry }: { error?: string | null; retry?: () => void }) =>
  error ? (
    <div style={{ padding: 20 }}>
      <div style={{ color: "#ff8080", marginBottom: 12 }}>{error}</div>
      {retry && <DialogButton style={{ width: 200 }} onClick={retry}>Retry</DialogButton>}
    </div>
  ) : <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><SteamSpinner style={{ width: 64, height: 64 }} /></div>;

function Home({ onOpen }: { onOpen: (o: Open) => void }) {
  const { data, error, retry } = useLoad<{ sections: Section[] }>("/home");
  if (!data) return <Loading error={error} retry={retry} />;
  return (
    <>
      {data.sections.map((s) => (
        <div key={s.title} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "8px 10px" }}>{s.title}</h3>
          <Items items={s.items.slice(0, 10)} onOpen={onOpen} />
        </div>
      ))}
    </>
  );
}

const SEARCH_TYPES = [
  { data: "songs", label: "Songs" }, { data: "albums", label: "Albums" },
  { data: "playlists", label: "Playlists" }, { data: "artists", label: "Artists" },
];

function Search({ onOpen }: { onOpen: (o: Open) => void }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("songs");
  const [path, setPath] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { data, error, retry } = useLoad<{ items: Item[] }>(path);
  useEffect(() => {
    clearTimeout(timer.current);
    if (text.trim()) timer.current = setTimeout(() => setPath(`/search?q=${encodeURIComponent(text.trim())}&type=${type}`), 600);
  }, [text, type]);
  return (
    <>
      <Focusable style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }} flow-children="horizontal">
        <div style={{ flex: 1 }}><TextField value={text} onChange={(e) => setText(e.target.value)} bShowClearAction /></div>
        <div style={{ width: 160 }}><Dropdown rgOptions={SEARCH_TYPES} selectedOption={type} onChange={(o) => setType(o.data)} /></div>
      </Focusable>
      {path && (data ? <Items items={data.items} onOpen={onOpen} /> : <Loading error={error} retry={retry} />)}
    </>
  );
}

function Library({ onOpen }: { onOpen: (o: Open) => void }) {
  const [shelf, setShelf] = useState("liked");
  const { data, error, retry } = useLoad<{ items: Item[] }>(`/library/${shelf}`);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  useEffect(() => setSelection(null), [shelf]);
  const shelves = [["liked", "Liked songs"], ["playlists", "Playlists"], ["downloads", "Downloads"]];
  const songs = shelf !== "playlists" ? data?.items ?? [] : [];
  const picked = songs.filter((i) => selection?.has(i.id));
  const allPicked = picked.length === songs.length;
  const toggle = (id: string) => setSelection((sel) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const after = (p: Promise<unknown>) => p.then(() => { setSelection(null); retry(); });
  const confirm = (title: string, description: string, ok: string, action: () => void) =>
    showModal(<ConfirmModal strTitle={title} strDescription={description} strOKButtonText={ok} bDestructiveWarning onOK={action} />);
  const btn: CSSProperties = { minWidth: 0, flex: 1 };
  const n = picked.length;
  return (
    <>
      <Focusable style={{ display: "flex", gap: 8, marginBottom: 10 }} flow-children="horizontal">
        {shelves.map(([id, label]) => (
          <DialogButton key={id} style={{ ...btn, opacity: shelf === id ? 1 : 0.6 }} onClick={() => setShelf(id)}>{label}</DialogButton>
        ))}
      </Focusable>
      {songs.length > 0 && !selection && (
        <Focusable style={{ display: "flex", gap: 8, marginBottom: 10 }} flow-children="horizontal">
          <DialogButton style={btn} onClick={() => play({ songs, index: 0 })}>Play all</DialogButton>
          <DialogButton style={btn} onClick={() => play({ songs, index: Math.floor(Math.random() * songs.length), shuffle: true })}>Shuffle</DialogButton>
          <DialogButton style={btn} onClick={() => setSelection(new Set())}>Select</DialogButton>
        </Focusable>
      )}
      {selection && (
        <>
          <Focusable style={{ display: "flex", gap: 8, marginBottom: 8 }} flow-children="horizontal">
            <DialogButton style={btn} onClick={() => setSelection(null)}>Done</DialogButton>
            <DialogButton style={btn} onClick={() => setSelection(allPicked ? new Set() : new Set(songs.map((i) => i.id)))}>
              {allPicked ? "Select none" : `Select all (${songs.length})`}
            </DialogButton>
          </Focusable>
          <Focusable style={{ display: "flex", gap: 8, marginBottom: 10 }} flow-children="horizontal">
            <DialogButton style={btn} disabled={!n} onClick={() => play({ songs: picked, index: 0 })}>Play {n}</DialogButton>
            <DialogButton style={btn} disabled={!n} onClick={() => after(cmd("enqueueAll", picked))}>Queue {n}</DialogButton>
            {shelf === "liked" && <DialogButton style={btn} disabled={!n} onClick={() => after(cmd("downloadAll", picked))}>Download {n}</DialogButton>}
            {shelf === "liked" && (
              <DialogButton style={btn} disabled={!n} onClick={() => confirm(
                `Remove ${n} from Liked?`, "They are unliked on YouTube Music too.", "Unlike",
                () => after(cmd("unlikeAll", picked)),
              )}>Unlike {n}</DialogButton>
            )}
            {shelf === "downloads" && (
              <DialogButton style={btn} disabled={!n} onClick={() => confirm(
                `Delete ${n} download${n === 1 ? "" : "s"}?`, "The files are removed from the Deck. The songs stay in your library.", "Delete",
                () => after(cmd("deleteDownloads", picked)),
              )}>Delete {n}</DialogButton>
            )}
          </Focusable>
        </>
      )}
      {data
        ? (data.items.length
          ? <Items items={data.items} onOpen={onOpen} selection={selection ?? undefined} onToggle={toggle} />
          : <div style={{ padding: 20, opacity: 0.6 }}>Nothing here yet.</div>)
        : <Loading error={error} retry={retry} />}
    </>
  );
}

function Collection({ open, onOpen, onBack }: { open: Open; onOpen: (o: Open) => void; onBack: () => void }) {
  const artist = open.type === "artist";
  const { data, error, retry } = useLoad<any>(artist ? `/artist?id=${encodeURIComponent(open.id)}` : `/collection?type=${open.type}&id=${encodeURIComponent(open.id)}`);
  const header = (
    <Focusable style={{ display: "flex", gap: 8, marginBottom: 10 }} flow-children="horizontal">
      <DialogButton style={{ minWidth: 0, flex: 1 }} onClick={onBack}>Back</DialogButton>
      {!artist && <DialogButton style={{ minWidth: 0, flex: 2 }} onClick={() => play({ type: open.type, id: open.id })}>Play</DialogButton>}
      {!artist && <DialogButton style={{ minWidth: 0, flex: 2 }} onClick={() => play({ type: open.type, id: open.id, shuffle: true })}>Shuffle</DialogButton>}
    </Focusable>
  );
  return (
    <>
      <h2 style={{ margin: "4px 10px 10px" }}>{data?.title ?? open.title}</h2>
      {header}
      {!data ? <Loading error={error} retry={retry} /> : artist
        ? (data.sections as Section[]).map((s) => (
          <div key={s.title}><h3 style={{ margin: "8px 10px" }}>{s.title}</h3><Items items={s.items} onOpen={onOpen} /></div>
        ))
        : <Items items={data.items} onOpen={onOpen} />}
    </>
  );
}

function Queue() {
  const { state, refresh } = usePlayer(2000);
  // The tapped row is marked at once; waiting for the next poll made the highlight trail the music.
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => { if (pending !== null && state?.index === pending) setPending(null); }, [state?.index]);
  if (!state) return <SteamSpinner />;
  if (!state.queue.length) return <div style={{ padding: 20, opacity: 0.6 }}>The queue is empty.</div>;
  const current = pending ?? state.index;
  return (
    <>
      {state.queue.map((item, k) => (
        <Row
          key={`${item.id}-${k}`}
          item={{ ...item, subtitle: `${item.subtitle}${item.autoplay ? " · autoplay" : ""}` }}
          active={k === current}
          onActivate={() => { setPending(k); cmd("jump", k).then(refresh); }}
          onSecondary={() => cmd("remove", k).then(refresh)}
          secondaryLabel="Remove"
        />
      ))}
    </>
  );
}

function LyricsView() {
  const { state } = usePlayer(500);
  const lyrics = useLyrics(state?.song?.id);
  const activeRef = useRef<HTMLDivElement>(null);
  const line = currentLine(lyrics, state?.positionMs ?? 0);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [line]);
  if (!state?.song) return <div style={{ padding: 20, opacity: 0.6 }}>Nothing playing.</div>;
  if (!lyrics || lyrics.loading || lyrics.songId !== state.song.id) return <SteamSpinner />;
  if (!lyrics.lines && !lyrics.plain) return <div style={{ padding: 20, opacity: 0.6 }}>No lyrics found for this song.</div>;
  return (
    <Focusable style={{ padding: "10px 20px", fontSize: 22, lineHeight: 1.6, textAlign: "center" }} onActivate={() => {}}>
      {lyrics.lines
        ? lyrics.lines.map((l, k) => (
          <div key={k} ref={k === line ? activeRef : undefined}
            style={{ opacity: k === line ? 1 : 0.4, fontWeight: k === line ? "bold" : undefined, color: k === line ? "#9fd4ff" : undefined }}>
            {l.text || "♪"}
          </div>
        ))
        : <div style={{ whiteSpace: "pre-wrap" }}>{lyrics.plain}</div>}
    </Focusable>
  );
}

export function FullPage() {
  const [tab, setTab] = useState(initialTab);
  const { state } = usePlayer(1500);
  const [claimed, setClaimed] = useState<string | null>(null);
  useEffect(() => { if (claimed && state?.song?.id === claimed) setClaimed(null); }, [state?.song?.id]);
  const playing = { id: claimed ?? state?.song?.id, claim: setClaimed };
  const [stack, setStack] = useState<Open[]>([]);
  const top = stack[stack.length - 1];
  const onOpen = (o: Open) => setStack((s) => [...s, o]);
  const browse = (content: ReactNode) => top
    ? <Collection key={`${top.type}:${top.id}`} open={top} onOpen={onOpen} onBack={() => setStack((s) => s.slice(0, -1))} />
    : content;

  return (
    <Playing.Provider value={playing}>
    <style>{ROW_CSS}</style>
    <div style={{ marginTop: 40, height: "calc(100% - 40px)", background: "#0e141b" }}>
      <Tabs
        activeTab={tab}
        onShowTab={(t: string) => { setTab(t); setStack([]); }}
        tabs={[
          { id: "home", title: "Home", content: browse(<Home onOpen={onOpen} />) },
          { id: "search", title: "Search", content: browse(<Search onOpen={onOpen} />) },
          { id: "library", title: "Library", content: browse(<Library onOpen={onOpen} />) },
          { id: "queue", title: "Queue", content: <Queue /> },
          { id: "lyrics", title: "Lyrics", content: <LyricsView /> },
        ]}
      />
    </div>
    </Playing.Provider>
  );
}
