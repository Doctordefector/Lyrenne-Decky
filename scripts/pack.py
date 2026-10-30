"""Builds out/Lyrenne.zip in the layout Decky installs: one top-level folder named after the plugin."""
import json, pathlib, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
name = json.loads((root / "plugin.json").read_text())["name"]
files = ["dist/index.js", "package.json", "plugin.json", "main.py", "LICENSE", "README.md"]
missing = [f for f in files if not (root / f).is_file()]
if missing:
    raise SystemExit(f"missing: {missing} (run pnpm build first)")
out = root / "out" / f"{name}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(root / f, f"{name}/{f}")
print(out)
