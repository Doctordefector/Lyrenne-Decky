import asyncio
import glob
import json
import os
import shutil
import subprocess
import tarfile
import urllib.error
import urllib.request

import decky

UNIT = "lyrenne-headless"
HANDSHAKE = os.path.join(decky.DECKY_USER_HOME, ".local", "share", "lyrenne", "headless.json")
APP_DIR = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "lyrenne")


def user_env():
    """systemd --user and PipeWire need the session's runtime dir, which a Decky backend may lack."""
    uid = os.getuid()
    env = dict(os.environ)
    env["XDG_RUNTIME_DIR"] = f"/run/user/{uid}"
    env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path=/run/user/{uid}/bus"
    env["HOME"] = decky.DECKY_USER_HOME
    return env


def unpack_bundled():
    """Decky's remote_binary drops the Deck build of Lyrenne in bin/ as is; unpack it once per version."""
    bin_dir = os.path.join(decky.DECKY_PLUGIN_DIR, "bin")
    tarballs = sorted(glob.glob(os.path.join(bin_dir, "lyrenne-deck-*.tar.gz")))
    if not tarballs:
        return
    stamp = os.path.join(APP_DIR, ".from")
    try:
        if open(stamp).read() == os.path.basename(tarballs[-1]):
            return
    except OSError:
        pass
    decky.logger.info(f"Unpacking {tarballs[-1]}")
    tmp = APP_DIR + ".new"
    shutil.rmtree(tmp, ignore_errors=True)
    with tarfile.open(tarballs[-1]) as t:
        # The archive holds one top folder, Lyrenne/; "tar" keeps exec bits but refuses paths
        # that escape the target.
        t.extractall(tmp, filter="tar")
    shutil.rmtree(APP_DIR, ignore_errors=True)
    os.rename(os.path.join(tmp, "Lyrenne"), APP_DIR)
    shutil.rmtree(tmp, ignore_errors=True)
    with open(stamp, "w") as f:
        f.write(os.path.basename(tarballs[-1]))


def launcher():
    """The Lyrenne the plugin installed, else a dev copy, else a system install."""
    candidates = [
        os.path.join(APP_DIR, "bin", "Lyrenne"),
        os.path.join(decky.DECKY_USER_HOME, "lyrenne-dev", "run-headless.sh"),
        "/opt/lyrenne/bin/Lyrenne",
    ]
    return next((c for c in candidates if os.access(c, os.X_OK)), None)


START_LOCK = asyncio.Lock()
def systemctl(*args):
    return subprocess.run(["systemctl", "--user", *args], env=user_env(), capture_output=True, text=True)


def handshake():
    try:
        with open(HANDSHAKE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def call(method, path, body=None, timeout=20):
    hs = handshake()
    if hs is None:
        raise ConnectionError("Lyrenne is not running")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"http://127.0.0.1:{hs['port']}{path}", data=data, method=method,
        headers={"X-Lyrenne-Token": hs["token"], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}") | {"status": e.code}


class Plugin:
    async def status(self):
        """running: daemon answers. installed: a launcher exists."""
        running = False
        if systemctl("is-active", "--quiet", UNIT).returncode == 0 or handshake():
            try:
                await asyncio.to_thread(call, "GET", "/state", None, 3)
                running = True
            except Exception:
                pass
        return {"running": running, "installed": launcher() is not None}

    async def start(self):
        # The panel starts the daemon when it opens and sign-in starts it too; one at a time.
        async with START_LOCK:
            return await self._start()

    async def _start(self):
        if (await self.status())["running"]:
            return True
        exe = launcher()
        if exe is None:
            decky.logger.error("No Lyrenne install found")
            return False
        systemctl("reset-failed", UNIT)
        r = subprocess.run(
            ["systemd-run", "--user", f"--unit={UNIT}", "--collect", exe, "--headless"],
            env=user_env(), capture_output=True, text=True,
        )
        # "already loaded" means a copy is still starting up (or stopping): wait on it below.
        if r.returncode != 0 and "already loaded" not in r.stderr:
            decky.logger.error(f"systemd-run failed: {r.stderr.strip()}")
            return False
        # JVM + VLC start takes a few seconds on the Deck, over 20 right after it wakes.
        for _ in range(90):
            await asyncio.sleep(0.5)
            if (await self.status())["running"]:
                decky.logger.info(f"Lyrenne started from {exe}")
                return True
        decky.logger.error("Lyrenne did not come up within 45 s")
        return False

    async def stop(self):
        try:
            await asyncio.to_thread(call, "POST", "/quit", None, 3)
        except Exception:
            pass
        await asyncio.sleep(1)
        systemctl("stop", UNIT)
        return True

    async def request(self, method: str, path: str, body=None):
        """The frontend's one door into the daemon's API."""
        try:
            return await asyncio.to_thread(call, method, path, body)
        except Exception as e:
            return {"error": str(e), "offline": True}

    async def _main(self):
        try:
            await asyncio.to_thread(unpack_bundled)
        except Exception as e:
            decky.logger.error(f"Could not unpack Lyrenne: {e}")
        decky.logger.info(f"Lyrenne plugin loaded, launcher: {launcher()}")

    async def _unload(self):
        # Music keeps playing across Decky reloads on purpose: only an uninstall stops it.
        pass

    async def _uninstall(self):
        await self.stop()
        shutil.rmtree(APP_DIR, ignore_errors=True)
