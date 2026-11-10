/* The Max for Live device, run in Node on a pretend Max and a pretend Live.
 *   python3 ableton/kit/build.py ableton/device.json && node --test ableton/tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const suite = require('../kit/test/jsfx_suite.js');

const { device } = suite({ bundle: path.join(__dirname, '..', 'MidiEvolver.js'), name: 'Midi Evolver', window: [860, 780] });

test('a held chord grows: more notes come out than went in', () => {
  const d = device({ live: { song: { is_playing: 1 } } });
  d.run(50);
  [48, 55, 64].forEach((p) => d.note(true, p, 100));
  d.run(12000);
  const b = d.midi();
  const pitches = new Set();
  for (let i = 0; i + 2 < b.length; i += 3) if ((b[i] & 0xF0) === 0x90 && b[i + 2] > 0) pitches.add(b[i + 1]);
  assert.ok(pitches.size > 3, 'it played ' + [...pitches].join(' '));
});

test('Insert the Take puts what it played on a new track beside this one', () => {
  const d = device();
  d.send('action', 'insertTake');
  assert.ok(/Hold a chord first/.test(d.status()), d.status());
  d.run(50);
  [48, 55, 64].forEach((p) => d.note(true, p, 100));
  d.run(8000);
  [48, 55, 64].forEach((p) => d.note(false, p));
  d.run(3000);
  d.send('action', 'insertTake');
  assert.ok(/^Put the take on a new track/.test(d.status()), d.status());
  assert.strictEqual(d.set.tracks.length, 2);
  const clip = d.set.tracks[1].kids.clip_slots[0].kids.clip;
  assert.ok(clip.notes.length > 3, clip.notes.length + ' notes');
  assert.strictEqual(d.set.slots[0].props.has_clip, 0, 'nothing on the device’s own track');
});

test('the window’s own Insert is answered, as the REAPER helper answers it', () => {
  const d = device();
  d.run(50);
  [48, 55, 64].forEach((p) => d.note(true, p, 100));
  d.run(6000);
  [48, 55, 64].forEach((p) => d.note(false, p));
  d.run(3000);
  d.paint();
  assert.ok(!d.texts().some((t) => /run “Midi Evolver Helper”/.test(t)), 'the window sees the helper running');
  const fx = d.ctx.fx;
  fx.evalIn('F_send_take(2)');
  d.run(100);
  d.paint();
  assert.strictEqual(d.set.tracks.length, 2, 'the take went on a new track');
  assert.ok(d.texts().some((t) => /^Put the take on a new track/.test(t)), 'the window shows the answer: ' + d.texts().filter((t) => /take/i.test(t)).join(' | '));
});
