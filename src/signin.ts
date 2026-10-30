import { toaster } from "@decky/api";
import { get, request } from "./api";

declare const SteamClient: any;
declare const appStore: any;

const SHORTCUT = "Lyrenne sign-in";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// ponytail: plain double quotes; the browser command is paths and a URL, never quotes or $
const quote = (arg: string) => `"${arg}"`;

/**
 * Signs in through a browser that Steam launches as a temporary non-Steam shortcut. In Game Mode
 * only an app Steam started gets its on-screen keyboard (STEAM + X) and controls, and closing it
 * drops you back into Steam. The daemon only waits for the login profile to fill with cookies.
 */
export async function signIn() {
  const browser = await get<{ name?: string; command?: string[]; error?: string }>("/login/browser");
  if (!browser.command) {
    toaster.toast({ title: "Can't sign in", body: browser.error ?? "No browser found" });
    return;
  }
  await request("POST", "/login", { external: true });
  const [exe, ...args] = browser.command;
  const appId: number = await SteamClient.Apps.AddShortcut(SHORTCUT, exe, "/", "");
  SteamClient.Apps.SetShortcutName(appId, SHORTCUT);
  SteamClient.Apps.SetAppLaunchOptions(appId, args.map(quote).join(" "));
  let gameId: string | undefined;
  for (let i = 0; i < 20 && !gameId; i++) {
    await sleep(250);
    gameId = appStore.GetAppOverviewByAppID(appId)?.m_gameid;
  }
  SteamClient.Apps.RunGame(gameId, "", -1, 100);
  toaster.toast({
    title: "Sign in to YouTube Music",
    body: `Tap "Accept all" on the cookie screen, then sign in (STEAM + X opens the keyboard). Close the tab when you're done.`,
    duration: 10000,
  });
  removeWhenDone(appId);
}

async function removeWhenDone(appId: number) {
  for (let i = 0; i < 240; i++) {
    await sleep(5000);
    const s = await get<{ login?: string | null }>("/state").catch(() => null);
    if (!s?.login || /^(Signed in|Error)/.test(s.login)) break;
  }
  SteamClient.Apps.RemoveShortcut(appId);
}
