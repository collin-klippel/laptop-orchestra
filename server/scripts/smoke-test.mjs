// Tiny end-to-end smoke test: spin up two socket.io clients against a
// running server and confirm each one sees the other in the roster.
//
// Usage (from repo root): node server/scripts/smoke-test.mjs

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 5000;

function makeClient(nickname) {
  const socket = io(SERVER_URL, { transports: ['websocket'] });

  let resolveRoster;
  const seen = new Promise((resolve) => {
    resolveRoster = resolve;
  });

  socket.on('users', (users) => {
    if (users.length >= 2) resolveRoster(users);
  });

  socket.on('connect', () => {
    socket.emit('join', { nickname }, (result) => {
      if (!result?.ok) {
        console.error(`[${nickname}] join failed:`, result);
        process.exit(1);
      }
    });
  });

  return { socket, seen };
}

const a = makeClient('alice');
const b = makeClient('bob');

const timer = setTimeout(() => {
  console.error('Timed out waiting for both clients to see a 2-person roster.');
  process.exit(1);
}, TIMEOUT_MS);

const [ra, rb] = await Promise.all([a.seen, b.seen]);
clearTimeout(timer);

const namesA = ra.map((u) => u.nickname).sort();
const namesB = rb.map((u) => u.nickname).sort();

console.log('alice sees:', namesA);
console.log('bob   sees:', namesB);

const ok =
  namesA.length === 2 &&
  namesB.length === 2 &&
  namesA[0] === 'alice' &&
  namesA[1] === 'bob' &&
  namesB[0] === 'alice' &&
  namesB[1] === 'bob';

a.socket.disconnect();
b.socket.disconnect();

if (!ok) {
  console.error('FAIL: rosters do not match expected [alice, bob].');
  process.exit(1);
}

console.log('OK: both clients see each other.');
process.exit(0);
