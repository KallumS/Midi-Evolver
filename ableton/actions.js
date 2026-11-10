/* Midi Evolver in Live: what "Midi Evolver Helper.lua" does in REAPER.
 *
 * The JSFX hands its take to the helper through shared memory (gmem
 * "MidiEvolver", the protocol in reascripts/me_place.lua). Here the device is
 * the helper: every tick moves the heartbeat, so the window's Insert and Drag
 * Out light up, and a request is answered in the same mailbox. The take goes
 * on a new MIDI track beside this one, so it is heard as played rather than
 * evolved again by the device; Live cannot start a drag from a device, so
 * Drag Out does the same and says so.
 *
 * The strip's Insert the Take reads the take from the device's own memory
 * (rec_n events of beat, status, data1, data2 from rec_base), as Middaw does.
 */
var EVOLVER = { MAGIC: 0, HEART: 1, REQ: 2, KIND: 3, QN0: 5, COUNT: 6, DONE: 11, RESULT: 12, LEN: 13, INST: 14,
                DONEINST: 15, MSGLEN: 199, MSG: 200, EVENTS: 1000, ME_MAGIC: 7301, DRAG: 1, INSERT: 2 };
var helper = { beat: 0, handled: null };

// A take's messages as notes, from the bar the first one starts in.
function takeNotes(read, n, length) {
  var on = {}, notes = [];
  for (var i = 0; i < n; i++) {
    var at = read(i * 4), st = Math.trunc(read(i * 4 + 1)) & 0xF0, pitch = Math.trunc(read(i * 4 + 2)), vel = Math.trunc(read(i * 4 + 3));
    if (st === 0x90 && vel > 0) on[pitch] = { start: at, len: 0, pitch: pitch, vel: vel };
    else if ((st === 0x80 || st === 0x90) && on[pitch]) {
      on[pitch].len = Math.max(1 / 32, at - on[pitch].start); notes.push(on[pitch]); delete on[pitch];
    }
  }
  Object.keys(on).forEach(function (k) { var x = on[k]; x.len = Math.max(1 / 32, length - x.start); notes.push(x); });
  if (!notes.length) return null;
  var first = Math.min.apply(null, notes.map(function (x) { return x.start; })), bar = 4, from = Math.floor(first / bar) * bar;
  notes.forEach(function (x) { x.start -= from; });
  notes.sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
  return { notes: notes, beats: Math.max(bar, Math.ceil((Math.max(length, first + 1) - from) / bar) * bar) };
}

function putTake(take, Live) {
  var r = Live.newTrackClip(take.notes, take.beats, 'Midi Evolver take');
  return r.ok ? { code: 2, text: 'Put the take on a new track: ' + take.notes.length + ' notes. Add an instrument to hear it.' }
              : { code: -3, text: r.message };
}

// The answer, in the mailbox, as UTF-8 bytes, the request number last.
function answer(g, id, inst, code, text) {
  var bytes = unescape(encodeURIComponent(text)).slice(0, 600);
  g[EVOLVER.MSGLEN] = bytes.length;
  for (var i = 0; i < bytes.length; i++) g[EVOLVER.MSG + i] = bytes.charCodeAt(i);
  g[EVOLVER.RESULT] = code;
  g[EVOLVER.DONEINST] = inst;
  g[EVOLVER.DONE] = id;
}

var ACTIONS = {
  tick: function (fx) {
    var g = fx.gmem[fx.gmemName] || (fx.gmem[fx.gmemName] = {});
    helper.beat = (helper.beat % 1000000) + 1;
    if ((helper.beat & 15) === 1) g[EVOLVER.HEART] = helper.beat;
    var id = g[EVOLVER.REQ] || 0;
    if (helper.handled === null) { helper.handled = id; return; }   // older requests were already given up on
    if (id === helper.handled || g[EVOLVER.MAGIC] !== EVOLVER.ME_MAGIC) return;
    helper.handled = id;
    var kind = Math.round(g[EVOLVER.KIND] || 0), inst = g[EVOLVER.INST] || 0;
    var take = takeNotes(function (k) { return g[EVOLVER.EVENTS + k] || 0; }, Math.round(g[EVOLVER.COUNT] || 0), g[EVOLVER.LEN] || 0);
    var res;
    if (!take) res = { code: -4, text: 'The take is empty. Hold some keys, then try again.' };
    else if (kind === EVOLVER.INSERT || kind === EVOLVER.DRAG) {
      res = putTake(take, Live);
      if (kind === EVOLVER.DRAG && res.code > 0) res.text = 'Live can’t drag from a device, so the take is on a new track. Drag the clip from there.';
    } else res = { code: -5, text: 'The device didn’t understand that request.' };
    answer(g, id, inst, res.code, res.text);
  },

  insertTake: function (fx, Live) {
    var n = Math.trunc(fx.getVar('rec_n')), base = Math.trunc(fx.getVar('rec_base'));
    if (!(n > 0)) return 'Hold a chord first: Midi Evolver keeps what it plays as the take.';
    var take = takeNotes(function (k) { return fx.rd(base + k); }, n, fx.getVar('take_len'));
    if (!take) return 'The take has no notes yet. Hold a chord, then try again.';
    return putTake(take, Live).text;
  }
};
