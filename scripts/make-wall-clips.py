"""
Wall-sized loops for the hero.

The loops in public/clips/loop are 960x540, for the shelf and the component
pages. The hero wall shows its tiles at about 340 CSS px and plays up to two
dozen of them at once, so every frame decoded at 960px there is mostly thrown
away. These are the same loops at 640x360 (still sharp at 2x on a wall tile,
seen at reduced opacity under the claim): under half the pixels to decode per
frame, and about a third of the bytes. `wallOf()` in
components/library/registry.ts maps one path to the other.

    python scripts/make-wall-clips.py           # after adding or re-cutting a loop
    FFMPEG=/path/to/ffmpeg python scripts/make-wall-clips.py

It needs an ffmpeg built with libx264. A clip already newer than its loop is
skipped, so it only re-encodes what changed.
"""
import os
import subprocess
from pathlib import Path

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
ROOT = Path(__file__).resolve().parent.parent / "public" / "clips"
SRC, OUT = ROOT / "loop", ROOT / "wall"
OUT.mkdir(exist_ok=True)

before = after = 0
for mp4 in sorted(SRC.glob("*.mp4")):
    out = OUT / mp4.name
    if not out.exists() or out.stat().st_mtime < mp4.stat().st_mtime:
        subprocess.run(
            [
                FFMPEG, "-v", "error", "-y", "-i", str(mp4), "-an",
                "-vf", "scale=640:360:flags=lanczos", "-r", "30",
                "-c:v", "libx264", "-profile:v", "high", "-preset", "veryslow", "-crf", "28",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
            ],
            check=True,
        )
    before += mp4.stat().st_size
    after += out.stat().st_size
    print(f"{mp4.name:28} {mp4.stat().st_size // 1024:4}KB -> {out.stat().st_size // 1024:4}KB")
print(f"total {before // 1024}KB -> {after // 1024}KB")
