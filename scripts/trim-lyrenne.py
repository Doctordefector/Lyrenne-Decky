"""Turns Lyrenne's Linux tarball into the Deck edition: python scripts/trim-lyrenne.py IN.tar.gz OUT.tar.gz

The plugin only ever runs `Lyrenne --headless`, so the windowed app's UI toolkit (Compose, Skia,
Material icons, Coil) is dead weight: about 80 MB of a 250 MB install. The SQLite driver also
carries native libraries for every OS; the Deck needs only Linux x86-64.
"""
import io, re, shutil, sys, tarfile, tempfile, zipfile
from pathlib import Path

# Jars (and Skia's native library) only the windowed UI loads. Matched on the file name before the
# version. Not runtime-jvm (SQLDelight's runtime) and not kotlinx-coroutines-swing.
UI_ONLY = re.compile(
    r"^(animation(-core)?-desktop|coil(-[a-z-]+)?-jvm|foundation(-layout)?-desktop|material[a-z0-9-]*-desktop"
    r"|ui(-[a-z]+)?-desktop|skiko-awt[a-z0-9-]*|libskiko-linux-x64\.so[a-z0-9.]*|lifecycle-[a-z-]+"
    r"|library-desktop|desktop-jvm|runtime(-saveable)?-desktop)"
)
SQLITE_KEEP = "org/sqlite/native/Linux/x86_64/"
HEADLESS_MAIN = "app.mainclass=com.lyrenne.desktop.headless.HeadlessKt" + chr(10)


def main(src, dst):
    work = Path(tempfile.mkdtemp())
    try:
        with tarfile.open(src) as t:
            t.extractall(work, filter="tar")
        app = work / "Lyrenne" / "lib" / "app"
        removed = [f for f in app.iterdir() if UI_ONLY.match(f.name)]
        mb = sum(f.stat().st_size for f in removed) / 1e6
        for f in removed:
            f.unlink()
        for jar in app.glob("sqlite-jdbc-*.jar"):
            strip_natives(jar)
        cfg = app / "Lyrenne.cfg"
        gone = {f.name for f in removed}
        lines = [l for l in cfg.read_text().splitlines(True)
                 if not (l.startswith("app.classpath=") and l.rsplit("/", 1)[-1].strip() in gone)]
        # The windowed entry point (MainKt) cannot even load without Compose: start headless directly.
        cfg.write_text("".join(HEADLESS_MAIN if l.startswith("app.mainclass=") else l for l in lines))
        with tarfile.open(dst, "w:gz") as t:
            t.add(work / "Lyrenne", arcname="Lyrenne")
        print(f"removed {len(removed)} UI-only files ({mb:.0f} MB): {sorted(gone)}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


def strip_natives(jar: Path):
    out = io.BytesIO()
    with zipfile.ZipFile(jar) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename.startswith("org/sqlite/native/") and not item.filename.startswith(SQLITE_KEEP):
                continue
            zout.writestr(item, zin.read(item.filename))
    jar.write_bytes(out.getvalue())


if __name__ == "__main__":
    main(*sys.argv[1:3])
