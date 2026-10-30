import {
  ButtonItem,
  DialogButton,
  DropdownItem,
  Field,
  Focusable,
  PanelSection,
  PanelSectionRow,
  ConfirmModal,
  showModal,
  SliderField,
  staticClasses,
} from "@decky/ui";
import { definePlugin, routerHook, toaster } from "@decky/api";
import { CSSProperties, useEffect, useState } from "react";
import {
  FaDownload, FaHeart, FaPause, FaPlay, FaRandom, FaRedo, FaRegHeart, FaStepBackward, FaStepForward,
} from "react-icons/fa";
import { bigThumb, cmd, currentLine, finishLogin, fmt, get, logout, signingIn, start, State, status, stop } from "./api";
import { signIn } from "./signin";
import { usePlayer, useLyrics } from "./hooks";
import { FullPage, ROUTE, openPage } from "./FullPage";
import { LyrenneIcon } from "./LyrenneIcon";

const iconButton: CSSProperties = { minWidth: 0, padding: "10px 0", flex: 1, display: "flex", justifyContent: "center" };
const buttonRow: CSSProperties = { display: "flex", gap: 6, margin: "4px 0" };

function Transport({ s }: { s: State }) {
  return (
    <Focusable style={buttonRow} flow-children="horizontal">
      <DialogButton style={{ ...iconButton, opacity: s.shuffle ? 1 : 0.45 }} onClick={() => cmd("shuffle")}><FaRandom /></DialogButton>
      <DialogButton style={iconButton} onClick={() => cmd("prev")}><FaStepBackward /></DialogButton>
      <DialogButton style={iconButton} onClick={() => cmd("toggle")}>{s.playing ? <FaPause /> : <FaPlay />}</DialogButton>
      <DialogButton style={iconButton} onClick={() => cmd("next")}><FaStepForward /></DialogButton>
      <DialogButton
        style={{ ...iconButton, opacity: s.repeat === "OFF" ? 0.45 : 1 }}
        onClick={() => cmd("repeat", s.repeat === "OFF" ? "ALL" : s.repeat === "ALL" ? "ONE" : "OFF")}
      >
        <FaRedo />{s.repeat === "ONE" && <span style={{ fontSize: 10, marginLeft: 2 }}>1</span>}
      </DialogButton>
    </Focusable>
  );
}

const SLEEP = [
  { data: 0, label: "Off" }, { data: 15, label: "15 min" }, { data: 30, label: "30 min" },
  { data: 45, label: "45 min" }, { data: 60, label: "1 hour" }, { data: 90, label: "1.5 hours" },
  { data: -1, label: "End of track" },
];

function Content() {
  const [daemon, setDaemon] = useState<{ running: boolean; installed: boolean } | null>(null);
  const [starting, setStarting] = useState(false);

  const boot = async () => {
    setStarting(true);
    await start();
    setDaemon(await status());
    setStarting(false);
  };
  useEffect(() => { status().then((d) => { setDaemon(d); if (!d.running && d.installed) boot(); }); }, []);

  if (!daemon || starting) return <PanelSection><PanelSectionRow><Field label="Starting Lyrenne..." /></PanelSectionRow></PanelSection>;
  if (!daemon.installed) return (
    <PanelSection>
      <PanelSectionRow><Field label="Lyrenne is not installed" description="Reinstall the plugin, or install Lyrenne in Desktop Mode." /></PanelSectionRow>
    </PanelSection>
  );
  if (!daemon.running) return (
    <PanelSection>
      <PanelSectionRow><ButtonItem layout="below" onClick={boot}>Start Lyrenne</ButtonItem></PanelSectionRow>
    </PanelSection>
  );
  return <Player onOffline={() => setDaemon({ ...daemon, running: false })} />;
}

function Player({ onOffline }: { onOffline: () => void }) {
  const { state: s } = usePlayer(1000);
  const lyrics = useLyrics(s?.song?.id);
  const [volume, setVolume] = useState<number | null>(null);
  const [popup, setPopup] = useState<PopupMode>(popupMode);

  useEffect(() => { if (s?.offline) onOffline(); }, [s?.offline]);
  if (!s || s.offline) return null;

  const song = s.song;
  const line = currentLine(lyrics, s.positionMs);
  const sleepLeft = s.sleepEndsAt ? Math.max(1, Math.round((s.sleepEndsAt - Date.now()) / 60000)) : null;

  return (
    <>
      <PanelSection title="Now playing">
        {song ? (
          <>
            <PanelSectionRow>
              <img src={bigThumb(song.thumb, 400)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
            </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ fontWeight: "bold", fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
              <div style={{ opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.subtitle}</div>
              {line >= 0 && lyrics?.lines && (
                <div style={{ marginTop: 6, fontStyle: "italic", color: "#9fd4ff", minHeight: 20 }}>{lyrics.lines[line].text || "♪"}</div>
              )}
              {s.error && <div style={{ marginTop: 6, color: "#ff8080", fontSize: 12 }}>{s.error}</div>}
            </PanelSectionRow>
            <PanelSectionRow>
              <SliderField
                label={`${fmt(s.positionMs)} / ${fmt(s.durationMs)}`}
                value={Math.floor(s.positionMs / 1000)}
                min={0}
                max={Math.max(1, Math.floor(s.durationMs / 1000))}
                step={5}
                onChange={(v) => cmd("seek", v * 1000)}
              />
            </PanelSectionRow>
            <PanelSectionRow><Transport s={s} /></PanelSectionRow>
            <PanelSectionRow>
              <Focusable style={buttonRow} flow-children="horizontal">
                <DialogButton style={iconButton} onClick={() => cmd("like", !s.liked)}>{s.liked ? <FaHeart color="#ff5a7a" /> : <FaRegHeart />}</DialogButton>
                <DialogButton style={{ ...iconButton, opacity: s.downloaded ? 0.45 : 1 }} disabled={s.downloaded} onClick={() => cmd("download")}><FaDownload /></DialogButton>
                <DialogButton style={{ ...iconButton, fontSize: 12 }} onClick={() => cmd("radio")}>Radio</DialogButton>
              </Focusable>
            </PanelSectionRow>
          </>
        ) : (
          <PanelSectionRow><Field label="Nothing playing" description="Pick something from Browse." /></PanelSectionRow>
        )}
        <PanelSectionRow>
          <SliderField
            label="Music volume"
            value={Math.round((volume ?? s.volume) * 100)}
            min={0} max={100} step={5} showValue valueSuffix="%"
            onChange={(v) => { setVolume(v / 100); cmd("volume", v / 100); }}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Lyrenne">
        <PanelSectionRow><ButtonItem layout="below" onClick={() => openPage("home")}>Home & search</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" onClick={() => openPage("library")}>Library</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" onClick={() => openPage("queue")}>Queue ({s.queue.length})</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={!song} onClick={() => openPage("lyrics")}>Lyrics</ButtonItem></PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Sleep timer"
            rgOptions={SLEEP}
            selectedOption={s.sleepEndOfTrack ? -1 : sleepLeft ? null : 0}
            strDefaultLabel={sleepLeft ? `${sleepLeft} min left` : "Off"}
            onChange={(o) => cmd("sleep", o.data)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Song change pop-up"
            rgOptions={POPUP}
            selectedOption={popup}
            onChange={(o) => { try { localStorage.setItem(POPUP_KEY, o.data); } catch {} setPopup(o.data); }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          {s.account ? (
            <ButtonItem
              layout="below"
              label="Account"
              description={s.account}
              onClick={() => showModal(
                <ConfirmModal
                  strTitle="Sign out of YouTube Music?"
                  strDescription="Music stops playing until you sign in again."
                  strOKButtonText="Sign out"
                  bDestructiveWarning
                  onOK={() => logout()}
                />,
              )}
            >Sign out</ButtonItem>
          ) : signingIn(s) ? (
            <ButtonItem
              layout="below"
              description={`Accept all cookies and sign in (STEAM + X opens the keyboard). Then close the browser tab, or press this.`}
              onClick={() => finishLogin()}
            >Finish sign-in</ButtonItem>
          ) : (
            <ButtonItem
              layout="below"
              description={s.login ?? `Needed to play music. Opens a browser: tap "Accept all" on the cookie screen, then sign in.`}
              onClick={() => signIn()}
            >Sign in to YouTube Music</ButtonItem>
          )}
        </PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" onClick={async () => { await stop(); onOffline(); }}>Quit Lyrenne</ButtonItem></PanelSectionRow>
      </PanelSection>
    </>
  );
}

/** Toasts the new track while a game is up, the way Steam announces achievements. */
// ponytail: localStorage in Steam's UI context; a per-device setting, nothing else needs it
const POPUP_KEY = "lyrenne.trackPopup";
type PopupMode = "sound" | "silent" | "off";
const popupMode = (): PopupMode => {
  try { return (localStorage.getItem(POPUP_KEY) as PopupMode) || "sound"; } catch { return "sound"; }
};
const POPUP = [
  { data: "sound", label: "With sound" }, { data: "silent", label: "Silent" }, { data: "off", label: "Off" },
];

declare const NotificationStore: any;

/**
 * Steam picks a toast's sound from a table keyed by its type (31 for every Decky toast), not from
 * the toast's own playSound, so a "silent" toast still chimed. Skip the sound for ours instead.
 */
function muteSilentToasts() {
  const store = NotificationStore;
  const original = store.PlayNotificationSound;
  store.PlayNotificationSound = function (notification: any) {
    if (notification?.data?.lyrenneSilent) return;
    return original.call(this, notification);
  };
  return () => { store.PlayNotificationSound = original; };
}

function watchTrackChanges() {
  let last: string | undefined;
  const id = setInterval(async () => {
    const s = await get<State>("/state").catch(() => null);
    const song = s && !s.offline ? s.song : null;
    const mode = popupMode();
    if (mode !== "off" && song && s!.playing && song.id !== last && last !== undefined) {
      toaster.toast({
        title: song.title,
        body: song.subtitle,
        logo: <img src={bigThumb(song.thumb, 120)} style={{ width: 48, height: 48, borderRadius: 4 }} />,
        duration: 4000,
        playSound: mode === "sound",
        // Read by muteSilentToasts: Steam itself ignores playSound.
        ...(mode === "silent" ? { lyrenneSilent: true } : {}),
      });
    }
    if (song) last = song.id;
    else if (last === undefined) last = "";
  }, 3000);
  return () => clearInterval(id);
}

export default definePlugin(() => {
  routerHook.addRoute(ROUTE, FullPage, { exact: true });
  const stopWatching = watchTrackChanges();
  const unmute = muteSilentToasts();
  return {
    name: "Lyrenne",
    titleView: (
      <div className={staticClasses.Title} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LyrenneIcon />Lyrenne
      </div>
    ),
    content: <Content />,
    icon: <LyrenneIcon />,
    onDismount() {
      stopWatching();
      unmute();
      routerHook.removeRoute(ROUTE);
    },
  };
});
