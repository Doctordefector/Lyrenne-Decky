# Lyrenne for Decky

YouTube Music in Steam Deck Game Mode. Play your library, search, browse home and read synced lyrics from the Quick Access Menu while a game runs.

This is the Steam Deck edition of [Lyrenne](https://github.com/Doctordefector/Lyrenne). It runs Lyrenne without a window in the background (`Lyrenne --headless`) and talks to it over localhost. Lyrenne handles the YouTube side: sign-in, stream resolution, lyrics and the library database. The plugin is the controller.

The Lyrenne it installs is a Deck-only build with the windowed app's UI stripped out: a 93 MB download, 157 MB installed. It uses about 250 MB of RAM and under 1% of one CPU core while playing, with no measurable battery cost.

## Features

- **Quick Access panel**: album art, title, artist, the current synced lyric line, seek, play/pause, previous/next, shuffle, repeat, like, download, start a radio from the current song, and a music volume separate from the game's.
- **Full-screen page** (opens over the game; the game keeps running):
  - Home feed
  - Search for songs, albums, playlists and artists
  - Library: liked songs, playlists, downloads
  - Album, playlist and artist pages
  - The queue
  - Full synced lyrics
- **Controller shortcuts** on any song: A plays from there, X plays next, Y adds to the queue. In the queue, X removes a song.
- **Select mode** in Liked songs and Downloads: pick songs to play, queue, download, unlike, or delete downloads from the Deck.
- **Sleep timer**: 15 to 90 minutes, or end of track.
- **Song change pop-ups** while you play, with sound, silent or off.
- **Hardware media buttons** (Bluetooth headsets and the like) work through MPRIS.
- **Downloads** play from disk, so they work offline.

## Signing in

YouTube won't stream to signed-out clients, so sign in first.

1. In the Lyrenne panel, press **Sign in to YouTube Music**. Steam opens a browser.
2. Tap **Accept all** on YouTube's cookie screen, then sign in. **STEAM + X** brings up the keyboard.
3. Close the browser's tab (or press **Finish sign-in** in the panel, or STEAM > Exit game). You're back in Steam, signed in.

It works the same from Desktop Mode.

## Install

The plugin isn't in the Decky store yet. To install it by hand:

1. Turn on Decky's Developer mode.
2. Under Developer, use **Install plugin from URL** and paste the link to `Lyrenne.zip` from this repo's releases. Decky downloads the Deck build of Lyrenne along with it.

## Developing

You need Node and pnpm 9. `pnpm i && pnpm build`, then:

```sh
ssh -N -L 8081:localhost:8080 deck@<deck-ip> &   # Steam's CEF debugger
DECK=deck@<deck-ip> scripts/deploy.sh            # build, pack, install through Decky
```

`deploy.sh` installs through Decky's own installer, so it exercises the same path as a release zip. Decky runs the old version's `_uninstall` on reinstall, which stops the Lyrenne daemon: start it again from the panel.

## Releasing

`lyrenne-version` names the Lyrenne release to build from. Bump `package.json`'s version, push a `vX.Y.Z` tag, and CI drafts a release with the trimmed Lyrenne (`scripts/trim-lyrenne.py`) and a `Lyrenne.zip` already pointing Decky at it.

## License

GPL-3.0-or-later, the same as Lyrenne. Based on [decky-plugin-template](https://github.com/SteamDeckHomebrew/decky-plugin-template) (BSD-3-Clause); its notice is at the end of LICENSE.
