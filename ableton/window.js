// The picture in the README: `node ableton/window.js` redraws ableton/window.png.
// C G E held for nine seconds with Live playing: the layers coming in.
require('./kit/test/picture.js')(__dirname, { bundle: 'MidiEvolver.js', w: 860, h: 900, live: { song: { is_playing: 1 } },
  go(d) { [48, 55, 64].forEach((p) => [0x90, p, 100].forEach((x) => d.send('msg_int', x))); d.run(9000); } });
