# laptop-orchestra

A shared marimba for laptop ensembles. Users sign in with a nickname,
see everyone else who is online, and play a 2-octave marimba via an
on-screen piano keyboard (click, tap, or computer keyboard). Each key
lights up as it's played.

## Stack

- **client/** — Vite + React + TypeScript, talking to the server over
`socket.io-client`.
- **server/** — Node + Express + Socket.IO, holding presence in memory.
- **shared/** — TypeScript types shared by both ends of the wire.

## Quickstart

```bash
npm install
npm run dev
```

This starts the server on `http://localhost:3001` and the client on
`http://localhost:5173`.

Open two browser windows side-by-side, enter different nicknames, and
watch each one appear in the other's roster in real time. Close a tab
and the other side updates within a second.

## Scripts

- `npm run dev` — runs server and client together
- `npm run dev:server` — server only
- `npm run dev:client` — client only
- `npm run build` — production builds for both packages
- `npm run link:aleatoric` — attach a globally linked local `aleatoric` to the client workspace (see below)
- `npm run unlink:aleatoric` — remove that link and reinstall from the lockfile

## Local `aleatoric` development

To work against a local checkout of `[aleatoric](https://www.npmjs.com/package/aleatoric)` instead of the npm tarball, use `npm link`. Adjust paths if your clone lives somewhere other than beside this repo.

1. In the package root of your `aleatoric` monorepo (for example `../aleatoric/packages/aleatoric` relative to this directory):
  ```bash
   npm install   # if you have not already
   npm run build # when you need a fresh dist/ (same as publish prep)
   npm link      # registers a global link for the name "aleatoric"
  ```
2. In **this** repository root:
  ```bash
   npm run link:aleatoric
  ```
   That runs `npm link aleatoric -w @laptop-orchestra/client` so only the client workspace uses the symlink.

To switch back to the registry version:

```bash
npm run unlink:aleatoric
```

That unlinks the workspace and runs `npm install` so `node_modules` matches `[package-lock.json](package-lock.json)` again.

**Do not commit** a `package-lock.json` that resolves `aleatoric` to a local path (for example `../aleatoric/...`) or sets `"link": true` for that package. CI uses `npm ci` and must install `aleatoric` from the npm registry. After local linking, avoid running `npm install` in a way that rewrites the lockfile until you have unlinked.

## Configuration

The client points at the server via `VITE_SERVER_URL`
(defaults to `http://localhost:3001`). The server's port is
controlled by `PORT` (defaults to `3001`).

## What's next

This repo is the substrate for richer collaboration (rooms, audio/MIDI
transport, shared scores). The wire protocol lives in
`[shared/types.ts](shared/types.ts)` and is intended to grow without
breaking existing fields.