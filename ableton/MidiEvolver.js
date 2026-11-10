/* Midi Evolver - built by ableton/kit/build.py from ableton/device.json. Do not edit; edit the sources and rebuild. */
var DEVICE = {"main": "Midi Evolver.jsfx", "title": "Midi Evolver"};
DEVICE.files = {"Midi Evolver.jsfx": "desc:Midi Evolver - held chords grow into evolving motion\nauthor:kallums\nversion:1.0\ntags:MIDI generator evolving texture arpeggio ostinato recorder\nabout:\n  # Midi Evolver\n  Hold some keys and the chord you hold grows into music that moves: a\n  bass, a held pad whose inner voices drift, repeated notes, a looping\n  arpeggio and high sparkling notes come in one after another and evolve\n  for as long as you hold the keys - slowly or quickly, as you choose, and\n  differently every time. Everything it plays is recorded; drag the take\n  into REAPER from the Media Explorer, or insert it on the track (both\n  need the Midi Evolver Helper script running).\n\nin_pin:none\nout_pin:none\noptions:no_meter gmem=MidiEvolver\n\nslider1:0<0,3,1{Build,Swell,Fade,Wander}>-Shape\nslider2:8<1,64,1>-Pace (bars)\nslider3:50<0,100,1>-Change (%)\nslider4:20<0,100,1>-Start (%)\nslider5:100<0,100,1>-Peak (%)\nslider6:0<0,1,1{New Each Time,Locked}>-Variation\nslider7:1<1,99999,1>-Variation Number\nslider8:30<0,100,1>-Feel (%)\nslider9:1<0,1,1{Off,On}>-Bass\nslider10:1<0,1,1{Off,On}>-Pad\nslider11:1<0,1,1{Off,On}>-Pulse\nslider12:1<0,1,1{Off,On}>-Arpeggio\nslider13:1<0,1,1{Off,On}>-Sparkle\nslider14:1<1,16,1>-Bass Channel\nslider15:1<1,16,1>-Pad Channel\nslider16:1<1,16,1>-Pulse Channel\nslider17:1<1,16,1>-Arpeggio Channel\nslider18:1<1,16,1>-Sparkle Channel\nslider19:0<-2,2,1>-Bass Octave\nslider20:0<-2,2,1>-Pad Octave\nslider21:0<-2,2,1>-Pulse Octave\nslider22:0<-2,2,1>-Arpeggio Octave\nslider23:0<-2,2,1>-Sparkle Octave\nslider24:85<0,100,1>-Bass Level (%)\nslider25:70<0,100,1>-Pad Level (%)\nslider26:75<0,100,1>-Pulse Level (%)\nslider27:80<0,100,1>-Arpeggio Level (%)\nslider28:60<0,100,1>-Sparkle Level (%)\nslider29:0<0,16,1{Omni,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16}>-MIDI In\nslider30:0<0,1,1{Muted,Played}>-Held Keys\nslider31:1<0,1,1{Ignored,Holds}>-Sustain Pedal\nslider32:0<0,3,1{Off,CC1,CC11,CC1 and CC11}>-Dynamics CC\nslider33:0<0,1,1{Where Played,At Edit Cursor}>-Place Take\n\n@init\n\n// ================================================================ memory map\n// Keep the table in CLAUDE.md current: overlapping regions corrupt silently.\nheld_base = 0;       // 128: a key counts as held (pressed, or kept by the pedal)\ndown_base = 128;     // 128: a key is physically down\nhvel_base = 256;     // 128: the velocity it was struck with\nch_base   = 384;     // 128: the held pitches, lowest first (ch_n of them)\nps_base   = 512;     // 16: the chord's pitch classes above its lowest note\ncpc_base  = 528;     // 12: which pitch classes the chord has\ncol_base  = 544;     // 16: colour tones, as offsets above the lowest note\nNL = 5;              // layers: 0 Bass, 1 Pad, 2 Pulse, 3 Arpeggio, 4 Sparkle\nL_on   = 600;  L_ch   = 608;  L_oct  = 616;  L_lvl  = 624;\nL_next = 632;  L_steps = 640; L_act  = 648;  L_len  = 656;\nL_th   = 664;  L_meter = 672; L_cyc  = 680;  L_a    = 688;\nL_b    = 696;  L_rot  = 704;  L_kofs = 712;  L_eprev = 720;\nrs_base  = 760;      // 8: one random stream per layer, and one more\npat_base = 800;      // 5 x 32: each layer's pattern\npad_base = 1000;     // 8 voices as pitches, 8 as they were (+16), 12 tones covered (+32)\npend_base = 1100;    // PN_MAX x 6: notes due later than this block\nPN_MAX   = 64;\nan_base  = 1600;     // AN_MAX x AN_W: notes sounding now (used, ch, pitch, off, layer, roll, start)\nAN_MAX   = 256;\nAN_W     = 8;\nsnd_base = 3700;     // 16 x 128: 1 + which an slot holds a channel's pitch\noq_base  = 5800;     // OQ_MAX x 4 (+4 to sort with): this block's output, sorted before it is sent\nOQ_MAX   = 1024;\nev_base  = 10000;    // EV_MAX x 4: this block's input\nEV_MAX   = 512;\nfocus_base = 12100;  // FOCUS_MAX x FOCUS_W: the keyboard's stops (window only)\nFOCUS_MAX = 64;\nFOCUS_W  = 6;\nroll_base = 12600;   // ROLL_MAX x 5: notes for the live view (pitch, start, end, layer, vel)\nROLL_MAX = 512;\nrec_base = 65536;    // REC_MAX x 4: the take (beat, status, data1, data2)\nREC_MAX  = 100000;\n\n// gmem (options:gmem=MidiEvolver), shared with reascripts/Midi Evolver Helper.lua.\n// The protocol is described in CLAUDE.md; change both sides together.\nG_MAGIC = 0; G_HEART = 1; G_REQ = 2; G_KIND = 3; G_TRACK = 4; G_QN0 = 5;\nG_COUNT = 6; G_TEMPO = 7; G_NUM = 8; G_DEN = 9; G_PLACE = 10; G_DONE = 11;\nG_RESULT = 12; G_LEN = 13; G_INST = 14; G_DONEINST = 15; G_FLAGS = 16;\nG_MSGLEN = 199; G_MSG = 200; G_EVENTS = 1000;\nME_MAGIC = 7301;     // \"this is protocol 1\"\n\ngfx_ext_retina < 1 ? ( gfx_ext_retina = 1 );\n\n// ---------------------------------------------------------------- palette\n// The house scheme (docs/COLOUR.md). Every grey satisfies R < G < B - the\n// load-bearing property, because a neutral grey at the same lightness reads\n// flat next to the accent. The accent and the two warning colours are the\n// only entries off that ramp.\nC_ACCENT = 0xFFF200;   // whatever is on: a chosen button, a held note sounding\nC_CTRL   = 0xA9AFBA;   // unchosen buttons, notes that have finished\nC_CTRL_H = 0xC0C6CF;   // button hover\nC_CTRL_D = 0x8F96A2;   // button held\nC_INK    = 0x14171C;   // text on ANY button, and button borders\nC_WARN   = 0xD2483F;   // marks a warning; never for words\nC_ROLL   = 0x111419;   // the live view's ground\nC_SUNK   = 0x1A1D23;   // sunken frames, panels\nC_POPUP  = 0x1B1F25;   // layer rows\nC_BEAT   = 0x1E2228;   // beat lines\nC_HOVER  = 0x22262D;   // row hover\nC_GROUND = 0x23272E;   // window chrome\nC_ACTIVE = 0x2A2F37;   // a playing layer's row, a control that is off\nC_SEP    = 0x3A404A;   // separators, panel borders, bar lines\nC_EDGE   = 0x6D7581;   // the edge of a field or setting, marks: 3:1 or more\nC_DIM    = 0x8A919C;   // disabled text only, and marks - too faint for words\nC_LABEL2 = 0xB0B6C0;   // secondary text: 7.35:1 on the ground\nC_TEXT   = 0xDDE1E7;   // body text\nC_PLAY   = 0xF2F4F7;   // the hold's place on the energy curve\nC_RING   = 0xF2F4F7;   // the keyboard focus ring - near-white, never the accent\nC_WARN_TEXT = 0xFF9E96; // a warning in words: 7.55:1 (the red itself is 3.4:1)\n\nfunction setx(c) (\n  gfx_r = ((c / 65536) | 0) / 255;\n  gfx_g = ((((c / 256) | 0) % 256)) / 255;\n  gfx_b = (c % 256) / 255;\n  gfx_a = 1;\n);\nfunction setxa(c, a) ( setx(c); gfx_a = a; );\n\n// Hover and held are derived, not stored: f > 0 toward white, f < 0 toward black.\nfunction shade(c, f) local(r, g, b) (\n  r = (c / 65536) | 0;\n  g = ((c / 256) | 0) % 256;\n  b = c % 256;\n  f > 0 ? (\n    r = r + (255 - r) * f; g = g + (255 - g) * f; b = b + (255 - b) * f;\n  ) : (\n    r = r * (1 + f); g = g * (1 + f); b = b * (1 + f);\n  );\n  ((r | 0) * 65536) + ((g | 0) * 256) + (b | 0);\n);\nHOVER_F =  0.18;\nHELD_F  = -0.18;\nfunction clampv(v, a, b) ( max(a, min(b, v)) );\nfunction fmodp(a, b) ( a - floor(a / b) * b );   // a mod b, never negative\n\n// ================================================================ the dice\n// Park and Miller's generator (Midi Variator's), one stream per layer, so a\n// variation number always gives the same choices and one layer's draws\n// never move another's. Done in doubles with floor() rather than %, which\n// may be 32-bit on some systems: 48271 * 2^31 is still exact in a double.\nfunction rnd(k) local(s) (\n  s = rs_base[k] * 48271;\n  s -= floor(s / 2147483647) * 2147483647;\n  rs_base[k] = s;\n  (s - 1) / 2147483646;\n);\nfunction rint(k, n) ( min(n - 1, floor(rnd(k) * n)) );\nfunction coin(k, p) ( rnd(k) < p );\nfunction seed_streams(sd) local(i) (\n  i = 0;\n  loop(8,\n    rs_base[i] = fmodp(sd * 7919 + i * 104729 + 12345, 2147483646) + 1;\n    loop(3, rnd(i));\n    i += 1;\n  );\n);\n// A value between 0 and 1 that is the same for the same variation and k:\n// the Wander shape's turning points.\nfunction hash01(k, sd) local(x) (\n  x = sin(k * 12.9898 + sd * 0.07813 + 1.234) * 43758.5453;\n  x - floor(x);\n);\nfunction smooth01(u) ( u = clampv(u, 0, 1); u * u * (3 - 2 * u) );\n// Smooth noise through hash01's points; point 0 is 0, so Wander starts low.\nfunction noise(u, sd) local(k, f, a, b) (\n  k = floor(u); f = u - k;\n  a = k == 0 ? 0 : hash01(k, sd); b = hash01(k + 1, sd);\n  a + (b - a) * (0.5 - 0.5 * cos($pi * f));\n);\n\n// ================================================================ settings\n// Derived values live here rather than in @slider, because the window writes\n// sliders directly and sliderchange() does not re-run @slider.\nfunction apply_sliders() local(i, n, k) (\n  shape   = slider1;\n  pace    = max(1, slider2);\n  change  = slider3 * 0.01;\n  e_start = slider4 * 0.01;\n  e_peak  = max(e_start, slider5 * 0.01);\n  locked  = slider6;\n  feel    = slider8 * 0.01;\n  L_on[0] = slider9 >= 0.5;  L_on[1] = slider10 >= 0.5; L_on[2] = slider11 >= 0.5;\n  L_on[3] = slider12 >= 0.5; L_on[4] = slider13 >= 0.5;\n  L_ch[0] = slider14 - 1; L_ch[1] = slider15 - 1; L_ch[2] = slider16 - 1;\n  L_ch[3] = slider17 - 1; L_ch[4] = slider18 - 1;\n  L_oct[0] = slider19; L_oct[1] = slider20; L_oct[2] = slider21;\n  L_oct[3] = slider22; L_oct[4] = slider23;\n  L_lvl[0] = slider24 * 0.01; L_lvl[1] = slider25 * 0.01; L_lvl[2] = slider26 * 0.01;\n  L_lvl[3] = slider27 * 0.01; L_lvl[4] = slider28 * 0.01;\n  in_chan   = slider29;\n  keys_thru = slider30;\n  pedal_on  = slider31;\n  dyn_cc    = slider32;\n  place_mode = slider33;\n  // Layers come in one after another as the energy rises - Belkin's\n  // crescendo by adding instruments in order, with the last kept back for\n  // the climax (decision 0003). The first layer that is on always plays.\n  n = 0; i = 0;\n  loop(NL, L_on[i] ? n += 1; i += 1; );\n  k = 0; i = 0;\n  loop(NL,\n    L_on[i] ? ( L_th[i] = n > 1 ? 0.85 * k / n : 0; k += 1; ) : ( L_th[i] = 2 );\n    i += 1;\n  );\n  // A faster pace changes the patterns more often as well as sooner.\n  rate_f = clampv(sqrt(8 / pace), 0.5, 2);\n);\n\n// ================================================================ the clock\n// bt is REAPER's beat while it plays and our own count while it is stopped;\n// vt never jumps (the live view and the take are timed by it). Steps fall on\n// a grid counted from `origin`: beat 0 while REAPER plays (its bar lines),\n// the first key while it is stopped.\nfunction bar_beats() ( ts_num > 0 && ts_denom > 0 ? ts_num * 4 / ts_denom : 4 );\nfunction next_grid(t, g) ( origin + ceil((t - origin) / g - 0.0001) * g );\nfunction to_off(t) ( clampv(floor((t - bt) / bps + 0.5), 0, samplesblock - 1) );\n\n// ================================================================ the chord\n// The held keys are the harmony (decision 0002). Every layer reads them as\n// a ladder of chord tones from the lowest key up; a pattern stores rungs,\n// not pitches, so it follows a new chord at once.\nfunction chord_rebuild() local(i, n, root, m, c, d, ok) (\n  n = 0; i = 0;\n  loop(128, held_base[i] ? ( ch_base[n] = i; n += 1; ); i += 1; );\n  ch_n = n;\n  memset(cpc_base, 0, 12);\n  m = 0;\n  n > 0 ? (\n    root = ch_base[0];\n    i = 0;\n    loop(n, cpc_base[(ch_base[i] - root) % 12] = 1; i += 1; );\n    i = 0;\n    loop(12, cpc_base[i] ? ( ps_base[m] = i; m += 1; ); i += 1; );\n    // One key alone is heard as a root: give it its fifth, a drone's\n    // open sound, rather than a ladder of octaves.\n    m == 1 ? ( ps_base[1] = 7; cpc_base[7] = 1; m = 2; );\n    ch_root = root;\n  );\n  ch_m = m;\n  // Colour tones: a whole tone above a chord tone (the 9th, 11th or 13th),\n  // never a semitone from anything held - Midi Variator's clash guard in\n  // pitch classes (decision 0005). C E G gives D and A, never F or B.\n  col_n = 0;\n  i = 0;\n  loop(12,\n    cpc_base[i] ? (\n      c = (i + 2) % 12;\n      ok = !cpc_base[c] && !cpc_base[(c + 1) % 12] && !cpc_base[(c + 11) % 12];\n      d = 0; loop(col_n, col_base[d] == c ? ok = 0; d += 1; );\n      ok ? ( col_base[col_n] = c; col_n += 1; );\n    );\n    i += 1;\n  );\n);\n\n// The i-th rung of the chord ladder above `base` (a pitch whose class is the root's).\nfunction tone(i, base) local(m) (\n  m = max(1, ch_m);\n  base + ps_base[fmodp(i, m)] + 12 * floor(i / m);\n);\n// The root moved into [lo, hi].\nfunction root_in(lo, hi) local(p) (\n  p = ch_root;\n  while (p < lo) ( p += 12; );\n  while (p > hi) ( p -= 12; );\n  p;\n);\n// The nearest colour tone to pitch p, within a whole tone, or -1.\nfunction colour_near(p) local(i, q, best, bd, d) (\n  best = -1; bd = 3; i = 0;\n  loop(col_n,\n    q = p - fmodp(p - ch_root, 12) + col_base[i];\n    d = abs(q - p); d > 6 ? ( q += q < p ? 12 : -12; d = abs(q - p); );\n    (d > 0 && d < bd) ? ( bd = d; best = q; );\n    i += 1;\n  );\n  best;\n);\n\n// ================================================================ notes out\n// Everything a block sends goes into oq first and is sorted by time, with a\n// note-off before a note-on at the same moment, so a repeated note is never\n// cut short by the release of the one before it.\nfunction q_add(t, s, d1, d2) local(p) (\n  oq_n < OQ_MAX ? (\n    p = oq_base + oq_n * 4;\n    p[0] = to_off(t); p[1] = s; p[2] = d1; p[3] = d2;\n    oq_n += 1;\n  );\n);\n\n// Takes back a note-on this block has queued: the last one for this pitch\n// on this channel at this offset.\nfunction q_unsend(o, s, d1) local(i, p, found) (\n  found = -1; i = 0;\n  loop(oq_n, p = oq_base + i * 4; (p[0] == o && p[1] == s && p[2] == d1 && p[3] > 0) ? found = i; i += 1; );\n  found >= 0 ? (\n    oq_n -= 1;\n    found < oq_n ? memcpy(oq_base + found * 4, oq_base + oq_n * 4, 4);\n  );\n  found >= 0;\n);\n\nfunction roll_add(p, t, L, v) local(r) (\n  r = roll_base + roll_w * 5;\n  r[0] = p; r[1] = vt + (t - bt); r[2] = -1; r[3] = L; r[4] = v;\n  roll_w = (roll_w + 1) % ROLL_MAX;\n  roll_n = min(ROLL_MAX, roll_n + 1);\n  (roll_w + ROLL_MAX - 1) % ROLL_MAX;\n);\n\nfunction an_end(i, t) local(a, ch, p, r) (\n  a = an_base + i * AN_W;\n  a[0] ? (\n    // A note pushed a little late by Feel may start after the moment that\n    // ends it: the end is never before the start (plus two samples, so the\n    // sort cannot put the note-off first).\n    t = max(t, a[6] + 2 * bps);\n    ch = a[1]; p = a[2];\n    // Struck in this block's last sample and ended at once, the two samples\n    // above are clamped back onto the note-on's own offset, and the sort puts\n    // a note-off first there - so the note would sound until the next chord.\n    // A note ended before it has sounded is not played: its note-on is taken\n    // back instead (decision 0009).\n    !(a[6] >= bt && to_off(t) <= to_off(a[6]) && q_unsend(to_off(a[6]), 0x90 | ch, p)) ?\n      q_add(t, 0x80 | ch, p, 0);\n    snd_base[ch * 128 + p] = 0;\n    r = roll_base + a[5] * 5;\n    (r[0] == p && r[2] < 0) ? r[2] = vt + (t - bt);\n    a[0] = 0;\n    an_cnt -= 1;\n  );\n);\n\n// A note from layer L at beat t, len beats long (len < 0: until released).\n// MIDI has one of each pitch on a channel: if the pitch is already sounding\n// and will sound longer (the pad's held voice, say, under a short arpeggio\n// note), it is struck again and keeps its longer end - so a quick note\n// never cuts a held one short (decision 0003).\nfunction note_on(t, L, p, v, len) local(ch, k, i, a, found, off, r) (\n  ch = L_ch[L];\n  p = clampv(floor(p + 0.5), 0, 127);\n  v = clampv(floor(v * L_lvl[L] + 0.5), 1, 127);\n  off = len < 0 ? 1000000000000 : t + max(0.02, len);\n  k = L_lvl[L] > 0 ? snd_base[ch * 128 + p] : -1;\n  (k > 0 && an_base[(k - 1) * AN_W + 6] >= t - 2 * bps) ? (\n    0;   // struck this very moment already (two layers on one note): once is enough\n  ) : (k > 0 && an_base[(k - 1) * AN_W + 3] > off) ? (\n    a = an_base + (k - 1) * AN_W;\n    q_add(t, 0x80 | ch, p, 0);\n    q_add(t, 0x90 | ch, p, v);\n    r = roll_base + a[5] * 5;\n    (r[0] == p && r[2] < 0) ? r[2] = vt + (t - bt);\n    a[5] = roll_add(p, t, a[4], v);\n    L_meter[L] = max(L_meter[L], v / 127);\n  ) : k >= 0 ? (\n    k > 0 ? an_end(k - 1, t);\n    found = -1; i = 0;\n    while (found < 0 && i < AN_MAX) ( an_base[i * AN_W] == 0 ? found = i; i += 1; );\n    found >= 0 ? (\n      a = an_base + found * AN_W;\n      a[0] = 1; a[1] = ch; a[2] = p; a[3] = off; a[4] = L; a[6] = t;\n      a[5] = roll_add(p, t, L, v);\n      found + 1 > an_hi ? an_hi = found + 1;\n      an_cnt += 1;\n      snd_base[ch * 128 + p] = found + 1;\n      q_add(t, 0x90 | ch, p, v);\n      L_meter[L] = max(L_meter[L], v / 127);\n    );\n  );\n);\n\nfunction note_off_pitch(t, L, p) local(k) (\n  k = snd_base[L_ch[L] * 128 + p];\n  (k > 0 && an_base[(k - 1) * AN_W + 4] == L) ? an_end(k - 1, t);\n);\n\nfunction layer_off(L, t) local(i) (\n  i = 0;\n  loop(an_hi, (an_base[i * AN_W] && an_base[i * AN_W + 4] == L) ? an_end(i, t); i += 1; );\n);\n\nfunction all_off(t) local(i) (\n  i = 0;\n  loop(an_hi, an_base[i * AN_W] ? an_end(i, t); i += 1; );\n  pn_n = 0;\n);\n\n// Notes due after this block (an echo, a rolled chord's later voices).\nfunction schedule(t, L, p, v, len) local(q) (\n  pn_n < PN_MAX ? (\n    q = pend_base + pn_n * 6;\n    q[0] = t; q[1] = L; q[2] = p; q[3] = v; q[4] = len;\n    pn_n += 1;\n  );\n);\nfunction pend_fire(i) local(q, last) (\n  q = pend_base + i * 6;\n  L_act[q[1]] ? note_on(q[0], q[1], q[2], q[3], q[4]);\n  // move the last one into its place\n  pn_n -= 1;\n  i < pn_n ? ( last = pend_base + pn_n * 6; memcpy(q, last, 6); );\n);\n\n// A step's note: now, or held over to the next block if its feel makes it\n// land past this one.\nfunction play(t, L, p, v, len) (\n  t >= bt_end ? schedule(t, L, p, v, len) : note_on(t, L, p, v, len);\n);\n\n// A little life: notes come a few milliseconds late (never early - a\n// scheduler cannot play before now) and a few steps louder or softer.\nfunction late() ( rnd(5) * 0.02 * feel );\nfunction jit() ( (rnd(5) + rnd(5) - 1) * 6 * feel );\n\n// ================================================================ energy\n// How much is going on, 0 to 1, after u paces of holding (decision 0004).\nfunction shape_at(u, sd) local(x) (\n  shape == 0 ? ( x = smooth01(u) ) :                     // Build: rise, then stay\n  shape == 1 ? ( x = 0.5 - 0.5 * cos($pi * u) ) :        // Swell: rise and fall, again\n  shape == 2 ? ( x = 1 - smooth01(u) ) :                 // Fade: from the top down\n               ( x = noise(max(0, u) * 2, sd) );        // Wander: anywhere, slowly\n  e_start + (e_peak - e_start) * x;\n);\nfunction energy_at(u) (\n  // Breathing: a slow, small drift on top, more of it with more Change.\n  clampv(shape_at(u, seed_now) + (noise(u * 6 + 50, seed_now) - 0.5) * 0.08 * change, 0, 1);\n);\n\n// ================================================================ the layers\nfunction grid_of(L) local(bb) (\n  bb = bar_beats();\n  L == 0 ? ( e_now < 0.35 ? bb : e_now < 0.7 ? ( bb / 2 == floor(bb / 2) ? bb / 2 : 1 ) : 1 ) :\n  L == 1 ? ( pace >= 8 ? 2 * bb : bb ) :\n  // the pulse stays in eighths until the very top: the background keeps\n  // its rests (Belkin), so the arpeggio can be heard through it\n  L == 2 ? ( e_now < 0.45 ? 1 : e_now < 0.9 ? 0.5 : 0.25 ) :\n  // The arpeggio adds subdivisions as it grows - eighths, triplets,\n  // sixteenths - Glass's additive process in Einstein on the Beach.\n  L == 3 ? ( e_now < 0.4 ? 0.5 : e_now < 0.7 ? 1 / 3 : 0.25 ) :\n           0.25;\n);\n\n// ---- Bass: the lowest held note, low down, held through.\nfunction step_bass(t) local(p, g, s, v, bb) (\n  g = grid_of(0); bb = bar_beats();\n  p = root_in(31, 42) + 12 * L_oct[0];\n  s = fmodp(floor((t - origin) / g + 0.5), max(1, floor(bb / g + 0.5)));\n  // On a weak strike now and then, the fifth; near the top, the octave above\n  // on the bar's last strike.\n  (s > 0 && coin(0, 0.3 * change * e_now)) ? ( p += p + 7 > 47 + 12 * L_oct[0] ? -5 : 7; );\n  (e_now > 0.8 && s == floor(bb / g + 0.5) - 1 && coin(0, 0.5 * change)) ? p += 12;\n  v = 58 + 50 * e_now + (s == 0 ? 8 : 0) + jit();\n  layer_off(0, t);\n  play(t + late(), 0, p, v, g * 0.95);\n);\n\n// ---- Pad: the chord held, voiced wide at the bottom and close at the top\n// (the overtone series, Belkin and Orchestration Analysis), its inner voices\n// moving one at a time.\n// Every chord tone has a voice.\nfunction pad_covered() local(i, ok) (\n  ok = 1; i = 0;\n  loop(12, (cpc_base[i] && !pad_base[32 + i]) ? ok = 0; i += 1; );\n  ok;\n);\nfunction pad_voicing() local(bot, n, i, j, k, p, want, lo) (\n  bot = root_in(43, 54) + 12 * L_oct[1];\n  want = clampv(3 + floor(e_now * 2.5), 3, 6);\n  memcpy(pad_base + 16, pad_base, 8);   // the voices as they were\n  pad_old = pad_n;\n  pad_base[0] = bot;\n  n = 1;\n  // the next voice a fifth or more above the bottom, then closer above\n  // that; every chord tone first (C3 G3 E4 for C E G - the third a tenth\n  // up), then doublings\n  memset(pad_base + 32, 0, 12);\n  pad_base[32 + fmodp(bot - ch_root, 12)] = 1;\n  // too few voices for every tone: leave out the fifth first, the part-\n  // writing books' rule (Dm7 in three voices is D3 C4 F4, not D3 A3 C4)\n  (want < ch_m && cpc_base[7] && ch_m > 2) ? pad_base[32 + 7] = 1;\n  lo = bot + 7;\n  i = 0;\n  while (n < want && i < 48) (\n    p = lo + i;\n    (cpc_base[fmodp(p - ch_root, 12)] && (!pad_base[32 + fmodp(p - ch_root, 12)] || pad_covered())) ? (\n      pad_base[n] = p; n += 1; pad_base[32 + fmodp(p - ch_root, 12)] = 1;\n      lo = p + (n < 3 ? 3 : 1) - i - 1;\n    );\n    i += 1;\n  );\n  pad_n = n;\n);\n\nfunction pad_sound(t) local(i, j, keep, p, sp) (\n  // release what is no longer in the voicing, strike what is new\n  i = 0;\n  loop(pad_old,\n    p = pad_base[16 + i]; keep = 0; j = 0;\n    loop(pad_n, pad_base[j] == p ? keep = 1; j += 1; );\n    !keep ? note_off_pitch(t, 1, p);\n    i += 1;\n  );\n  sp = 0;\n  i = 0;\n  loop(pad_n,\n    p = pad_base[i]; keep = 0; j = 0;\n    loop(pad_old, pad_base[16 + j] == p ? keep = 1; j += 1; );\n    !keep ? (\n      // a struck chord is rolled a little, bottom to top\n      sp == 0 ? note_on(t, 1, p, 50 + 40 * e_now + jit(), -1)\n              : schedule(t + sp * 0.012 * feel + 0.0001, 1, p, 50 + 40 * e_now + jit(), -1);\n      sp += 1;\n    );\n    i += 1;\n  );\n  pad_old = pad_n;\n  memcpy(pad_base + 16, pad_base, 8);\n);\n\nfunction pad_move(t) local(i, j, p, q, d, tries, ok, top, want) (\n  memcpy(pad_base + 16, pad_base, 8); pad_old = pad_n;\n  want = clampv(3 + floor(e_now * 2.5), 3, 6);\n  // grow or thin with the energy, from the top\n  pad_n < want ? (\n    p = pad_base[pad_n - 1] + 1; q = -1; d = 0;\n    while (q < 0 && d < 12) ( cpc_base[fmodp(p + d - ch_root, 12)] ? q = p + d; d += 1; );\n    q > 0 ? ( pad_base[pad_n] = q; pad_n += 1; );\n  ) : pad_n > want ? ( pad_n -= 1; ) :\n  coin(1, 0.35 + 0.6 * change) ? (\n    // one inner or top voice steps to the next chord tone up or down, or,\n    // with more Change and energy, to a colour tone a whole tone away\n    tries = 0; ok = 0;\n    while (!ok && tries < 8) (\n      i = 1 + rint(1, max(1, pad_n - 1));\n      p = pad_base[i];\n      (col_n > 0 && coin(1, 0.5 * change * e_now)) ? (\n        q = colour_near(p);\n      ) : (\n        d = coin(1, 0.5) ? 1 : -1; q = p + d;\n        while (!cpc_base[fmodp(q - ch_root, 12)] && abs(q - p) < 12) ( q += d; );\n      );\n      ok = q > pad_base[0] + 4 && q < pad_base[0] + 30;\n      j = 0; loop(pad_n, pad_base[j] == q ? ok = 0; j += 1; );\n      ok ? pad_base[i] = q;\n      tries += 1;\n    );\n  );\n  pad_sound(t);\n);\n\nfunction step_pad(t) (\n  L_steps[1] == 0 ? ( pad_n = 0; pad_old = 0; pad_voicing(); pad_old = 0; pad_sound(t); )\n                  : pad_move(t);\n);\n\n// ---- Pulse: repeated notes on a Euclidean rhythm that fills in as the\n// energy rises, its accents turning a step at a time (Reich's phasing).\nfunction step_pulse(t) local(g, n, s, k, on, p, v, base, w) (\n  g = grid_of(2);\n  n = max(1, floor(bar_beats() / g + 0.5));\n  s = fmodp(floor((t - origin) / g + 0.5), n);\n  (s == 0 && L_steps[2] > 0 && coin(2, 0.5 * change * rate_f)) ? (\n    w = rnd(2);\n    w < 0.6 ? ( L_rot[2] += coin(2, 0.5) ? 1 : -1; ) :\n    w < 0.8 ? ( L_kofs[2] = clampv(L_kofs[2] + (coin(2, 0.5) ? 1 : -1), -2, 2); ) :\n              ( L_b[2] = L_a[2] - 1 - rint(2, 2); );\n  );\n  k = clampv(floor(n * (0.3 + 0.45 * e_now) + 0.5) + L_kofs[2], 1, n);\n  on = fmodp((s + L_rot[2]) * k, n) < k;\n  on ? (\n    base = root_in(55, 66) + 12 * L_oct[2];\n    p = tone((s % 2) == 0 ? L_a[2] : L_b[2], base);\n    v = 52 + 48 * e_now + (s == 0 ? 10 : (s % 2) ? -8 : 0) + jit();\n    play(t + late(), 2, p, v, g * (e_now > 0.6 ? 0.45 : 0.8));\n  );\n);\n\n// ---- Arpeggio: a looping figure of 5 to 7 notes against a bar of 4, so it\n// phases against the bar (Reich's loops of different lengths). At the end of\n// each time round it may turn, grow a note or lose one (Glass's additive\n// process), or move a note to its neighbour.\nfunction arp_mutate() local(L, n, w, j, m, de) (\n  L = 3; n = L_len[3]; m = max(1, ch_m);\n  de = e_now - L_eprev[3]; L_eprev[3] = e_now;\n  coin(3, change * rate_f) ? (\n    w = rnd(3) * 10 + (de > 0.01 ? -1.5 : de < -0.01 ? 1.5 : 0);\n    w < 2.5 ? (\n      // turn: start from the second note (phase shift)\n      j = pat_base[L * 32]; memcpy(pat_base + L * 32, pat_base + L * 32 + 1, n - 1);\n      pat_base[L * 32 + n - 1] = j;\n    ) : w < 4.5 ? (\n      n < 12 ? ( pat_base[L * 32 + n] = max(0, pat_base[L * 32 + n - 1] + (coin(3, 0.5) ? 1 : -1)); L_len[3] = n + 1; );\n    ) : w < 6 ? (\n      n > 3 ? L_len[3] = n - 1;\n    ) : w < 8.5 ? (\n      j = rint(3, n); pat_base[L * 32 + j] = max(0, pat_base[L * 32 + j] + (coin(3, 0.5) ? 1 : -1));\n    ) : (\n      j = rint(3, n);\n      pat_base[L * 32 + j] >= m ? ( pat_base[L * 32 + j] -= m; ) : ( pat_base[L * 32 + j] += m; );\n    );\n  );\n);\n\nfunction step_arp(t) local(g, i, span, idx, p, v, base, m, c) (\n  g = grid_of(3);\n  i = L_steps[3] % max(1, L_len[3]);\n  (i == 0 && L_steps[3] > 0) ? ( arp_mutate(); L_cyc[3] += 1; );\n  i = L_steps[3] % max(1, L_len[3]);\n  m = max(1, ch_m);\n  // the figure opens up in register as the energy rises: one octave, then two, then three\n  span = clampv(1 + floor(e_now * 2.6), 1, 3);\n  idx = fmodp(pat_base[3 * 32 + i], span * m);\n  base = root_in(55, 66) + 12 * L_oct[3];\n  p = tone(idx, base);\n  // an unaccented step may become a colour tone - a neighbour that the next\n  // step leaves (Open Music Theory's unaccented neighbour)\n  (i % 2 == 1 && col_n > 0 && coin(3, 0.15 * change * e_now)) ? ( c = colour_near(p); c > 0 ? p = c; );\n  v = 50 + 52 * e_now + (i == 0 ? 10 : (i % 2) ? -6 : 0) + jit();\n  play(t + late(), 3, p, v, g * (e_now > 0.7 ? 0.6 : 0.9));\n);\n\n// ---- Sparkle: high, soft, sparse notes, some of them echoed.\nfunction step_sparkle(t) local(p, v, base, len, n, idx) (\n  coin(4, clampv((e_now - L_th[4]) / max(0.05, 1 - L_th[4]), 0, 1) * (0.12 + 0.18 * change)) ? (\n    base = root_in(67, 78) + 12 * L_oct[4];\n    n = max(1, ch_m) * 2;\n    idx = rint(4, n);\n    p = tone(idx, base);\n    (col_n > 0 && coin(4, 0.3 * change)) ? ( p = colour_near(p) > 0 ? colour_near(p) : p; );\n    p == L_a[4] ? p = tone(idx + 1, base);\n    L_a[4] = p;\n    v = 38 + 40 * e_now + jit();\n    len = 0.25 + rint(4, 3) * 0.25;\n    play(t + late(), 4, p, v, len);\n    // an echo three sixteenths later, softer (Orchestration Analysis'\n    // doubling by displacement in time)\n    coin(4, 0.4) ? schedule(t + 0.75, 4, p, v * 0.7, len);\n  );\n);\n\nfunction step(L, t) (\n  L == 0 ? step_bass(t) : L == 1 ? step_pad(t) : L == 2 ? step_pulse(t) :\n  L == 3 ? step_arp(t) : step_sparkle(t);\n  L_steps[L] += 1;\n);\n\n// ---- a new variation for a new hold\nfunction arp_pattern() local(n, c, i, h) (\n  n = 5 + rint(3, 3);\n  c = rint(3, 4);\n  h = ceil(n / 2);\n  i = 0;\n  loop(n,\n    pat_base[3 * 32 + i] =\n      c == 0 ? i :                                   // up\n      c == 1 ? ( i < h ? i : n - i ) :               // up and down\n      c == 2 ? n - 1 - i :                           // down\n               ( i % 2 == 0 ? i / 2 : (i - 1) / 2 + 2 );  // leaping: 0 2 1 3 2 4 3\n    i += 1;\n  );\n  L_len[3] = n;\n);\n\nfunction new_variation(sd) local(i) (\n  seed_now = sd;\n  seed_streams(sd);\n  i = 0;\n  loop(NL,\n    L_steps[i] = 0; L_act[i] = 0; L_cyc[i] = 0; L_rot[i] = 0; L_kofs[i] = 0; L_eprev[i] = 0; L_a[i] = 0;\n    i += 1;\n  );\n  arp_pattern();\n  L_rot[2] = rint(2, 4);\n  L_a[2] = max(1, ch_m) + rint(2, 2);       // the pulse's two notes, near the top of an octave\n  L_b[2] = L_a[2] - 1 - rint(2, 2);\n  L_a[4] = -1;\n  pad_n = 0; pad_old = 0;\n);\n\n// Brings layers in and out with the energy. A layer that leaves lets its\n// short notes ring out; the pad's held voices are released.\nfunction layers_update(t) local(i) (\n  i = 0;\n  loop(NL,\n    (L_on[i] && !L_act[i] && e_now >= L_th[i]) ? (\n      L_act[i] = 1; L_steps[i] = 0;\n      L_next[i] = (i <= 1 && hold_fresh) ? t : next_grid(t, grid_of(i));\n    ) : (L_act[i] && (!L_on[i] || e_now < L_th[i] - 0.04)) ? (\n      L_act[i] = 0;\n      i == 1 ? ( layer_off(1, t); pad_n = 0; );\n    );\n    i += 1;\n  );\n  hold_fresh = 0;\n);\n\n// ================================================================ dynamics CC\nfunction send_dyn(t) local(v, i, j, dup, ch) (\n  dyn_cc > 0 ? (\n    v = clampv(floor(30 + 90 * e_now + 0.5), 0, 127);\n    v != dyn_last ? (\n      dyn_last = v;\n      i = 0;\n      loop(NL,\n        L_on[i] ? (\n          ch = L_ch[i]; dup = 0; j = 0;\n          loop(i, (L_on[j] && L_ch[j] == ch) ? dup = 1; j += 1; );\n          !dup ? (\n            (dyn_cc == 1 || dyn_cc == 3) ? q_add(t, 0xB0 | ch, 1, v);\n            (dyn_cc == 2 || dyn_cc == 3) ? q_add(t, 0xB0 | ch, 11, v);\n          );\n        );\n        i += 1;\n      );\n    );\n  );\n);\n\n// ================================================================ holding\nfunction hold_begin(t) local(sd) (\n  holding = 1;\n  hold_t0 = t;\n  hold_vt0 = vt + (t - bt);\n  hold_fresh = 1;\n  play_now ? 0 : ( (rec_on && take_live) ? 0 : origin = t );\n  sd = locked ? slider7 : 1 + floor(fmodp(time_precise() * 7919.37 + rand(1000), 1) * 99999);\n  // fmodp of a fraction: the time's fractional part spread over 1..99999\n  cur_seed = clampv(floor(sd), 1, 99999);\n  new_variation(cur_seed);\n  holds_n += 1;\n  // The take: a new one for each hold, unless Record is gathering them. A\n  // take made with Record waits for Drag Out, Insert or Clear: a hold\n  // afterwards plays but is not kept, so it can never be lost by touching a key.\n  (!take_live && !(take_kind == 2 && take_ready && !rec_on)) ? (\n    rec_n = 0; rec_notes = 0; take_live = 1; take_ready = 0; take_kind = rec_on ? 2 : 1;\n    rt = -(t - bt); rt_blk = rt;\n    take_qn0 = play_now ? t : -1;\n    take_tempo = tempo; take_num = ts_num > 0 ? ts_num : 4; take_den = ts_denom > 0 ? ts_denom : 4;\n    take_jumped = 0;\n    take_id += 1;\n  );\n  e_now = energy_at(0);\n  dyn_last = -1;\n  send_dyn(t);\n  layers_update(t);\n);\n\nfunction hold_end(t) local(i) (\n  holding = 0;\n  all_off(t);\n  i = 0; loop(NL, L_act[i] = 0; i += 1; );\n  pad_n = 0;\n  // without Record, a take is one hold\n  // the take ends once this block's last messages - these note-offs - are in it\n  (take_live && !rec_on) ? ( take_len = rt_blk + (t - bt); take_end_req = 1; );\n);\n\n// A chord is gathered for a moment before it counts, so a chord played a\n// little spread is one change, not three (and a rolled first chord is one\n// hold start).\nfunction chord_settle(t) (\n  chord_due = -1;\n  chord_rebuild();\n  ch_n > 0 ? (\n    !holding ? hold_begin(t) : (\n      // a new chord while holding: the bass and the pad follow at once\n      L_act[1] && L_steps[1] > 0 ? ( pad_voicing(); pad_sound(t); );\n      L_act[0] && ch_root != bass_root ? ( L_next[0] = t; );\n    );\n    bass_root = ch_root;\n  ) : (\n    holding ? hold_end(t);\n  );\n);\n\n// ================================================================ the take\nfunction rec_add(off, s, d1, d2) local(p) (\n  (take_live && rec_n < REC_MAX) ? (\n    p = rec_base + rec_n * 4;\n    // (a key let through just before its hold began is moved to the start)\n    p[0] = max(0, rt_blk + off * bps); p[1] = s; p[2] = d1; p[3] = d2;\n    rec_n += 1;\n    ((s & 0xF0) == 0x90 && d2 > 0) ? rec_notes += 1;\n  );\n);\n\n// ================================================================ input\nfunction key_event(t, m1, m2, m3) local(st, chn, wasdn, i) (\n  st = m1 & 0xF0; chn = m1 & 0x0F;\n  (in_chan == 0 || chn == in_chan - 1) ? (\n    (st == 0x90 && m3 > 0) ? (\n      down_base[m2] = 1; held_base[m2] = 1; hvel_base[m2] = m3;\n      // your own key, let through, is a note like any other (layer 5), so a\n      // generated note on the same pitch strikes it again but never ends it\n      keys_thru ? ( L_ch[5] = chn; L_lvl[5] = 1; note_on(t, 5, m2, m3, -1); );\n      chord_due < 0 ? chord_due = t + settle_beats;\n      1;\n    ) : (st == 0x80 || (st == 0x90 && m3 == 0)) ? (\n      wasdn = down_base[m2];\n      down_base[m2] = 0;\n      (pedal_on && pedal_down) ? 0 : ( held_base[m2] = 0; chord_due < 0 ? chord_due = t + settle_beats; );\n      (keys_thru && wasdn) ? ( L_ch[5] = chn; note_off_pitch(t, 5, m2); );\n      1;\n    ) : (st == 0xB0 && m2 == 64 && pedal_on) ? (\n      pedal_down = m3 >= 64;\n      !pedal_down ? (\n        i = 0;\n        loop(128, (held_base[i] && !down_base[i]) ? ( held_base[i] = 0; chord_due < 0 ? chord_due = t + settle_beats; ); i += 1; );\n      );\n      1;\n    ) : (st == 0xB0 && (m2 == 120 || m2 == 123)) ? (\n      memset(held_base, 0, 128); memset(down_base, 0, 128); pedal_down = 0;\n      chord_due = t;\n      q_add(t, m1, m2, m3);\n      1;\n    ) : 0;\n  ) : 0;\n);\n\n// Runs the music forward to beat tb, one event at a time in order: notes\n// ending, notes due, chords settling, layers stepping.\nfunction run_to(tb) local(go, tmin, kind, idx, i) (\n  go = 1;\n  while (go) (\n    tmin = tb; kind = 0;\n    i = 0;\n    loop(an_hi, (an_base[i * AN_W] && an_base[i * AN_W + 3] < tmin) ? ( tmin = an_base[i * AN_W + 3]; kind = 1; idx = i; ); i += 1; );\n    (chord_due >= 0 && chord_due < tmin) ? ( tmin = chord_due; kind = 4; );\n    i = 0;\n    loop(pn_n, pend_base[i * 6] < tmin ? ( tmin = pend_base[i * 6]; kind = 2; idx = i; ); i += 1; );\n    holding ? (\n      i = 0;\n      loop(NL, (L_act[i] && L_next[i] < tmin) ? ( tmin = L_next[i]; kind = 3; idx = i; ); i += 1; );\n    );\n    kind == 0 ? go = 0 :\n    kind == 1 ? an_end(idx, tmin) :\n    kind == 2 ? pend_fire(idx) :\n    kind == 4 ? chord_settle(tmin) :\n    // (the next grid line at least 0.01 beat on, so a step is never repeated)\n    ( step(idx, tmin); L_next[idx] = next_grid(tmin + 0.01, grid_of(idx)); );\n  );\n);\n\n// Everything a hold has started is stopped: Panic.\nfunction panic() local(i) (\n  all_off(bt);\n  memset(held_base, 0, 128); memset(down_base, 0, 128);\n  pedal_down = 0; chord_due = -1; holding = 0; ch_n = 0; ch_m = 0;\n  i = 0; loop(NL, L_act[i] = 0; i += 1; );\n  (take_live && !rec_on) ? ( take_len = rt_blk + (bt_end - bt); take_end_req = 1; );\n);\n\n// Record, clicked in the window, acted on here in the audio thread.\nfunction record_toggle() (\n  rec_on ? (\n    rec_on = 0;\n    (take_live && !holding) ? ( take_len = rt_blk; take_end_req = 1; );\n  ) : (\n    rec_on = 1;\n    !holding ? ( take_live = 0; rec_n = 0; rec_notes = 0; take_ready = 0; take_kind = 2; );\n  );\n);\n\n// ================================================================ first init\n// @init runs again when the transport starts. @serialize being non-empty\n// keeps memory through that, and so does this guard: what is sounding goes\n// on sounding, in time with REAPER, instead of being cut off (stuck) by a\n// reset.\ninit_done ? 0 : (\n  inst_id = 1 + floor(rand(999999));\n  cur_seed = 1;\n  chord_due = -1;\n  init_done = 1;\n  ui_zoom = 1;\n);\napply_sliders();\ngmem[G_MAGIC] = ME_MAGIC;\n\n@slider\n\napply_sliders();\n\n@block\n\nbps = tempo / 60 / srate;               // beats per sample\nblk_beats = samplesblock * bps;\nsettle_beats = 0.025 * tempo / 60;      // 25 ms\nplay_now = (play_state == 1 || play_state == 5);\n\n// Following REAPER: a start, a jump or a loop going round moves our beat\n// to REAPER's. Notes sounding keep their remaining lengths; layers find\n// their places on REAPER's grid.\nplay_now ? (\n  (!was_playing || abs(beat_position - bt) > 0.02) ? (\n    jump = beat_position - bt;\n    i = 0;\n    loop(an_hi, (an_base[i * AN_W] && an_base[i * AN_W + 3] < 100000000000) ? an_base[i * AN_W + 3] += jump; i += 1; );\n    i = 0; loop(pn_n, pend_base[i * 6] += jump; i += 1; );\n    chord_due >= 0 ? chord_due += jump;\n    bt = beat_position;\n    origin = 0;\n    i = 0; loop(NL, L_act[i] ? L_next[i] = next_grid(bt, grid_of(i)); i += 1; );\n    (take_live && was_playing) ? take_jumped = 1;\n  );\n);\nwas_playing = play_now;\nbt_end = bt + blk_beats;\noq_n = 0;\nrt_blk = rt;\n\n// What the window asked for since the last block.\npanic_req ? ( panic_req = 0; panic(); );\nrec_req ? ( rec_req = 0; record_toggle(); );\n\nholding ? (\n  e_now = energy_at((vt - hold_vt0) / (pace * bar_beats()));\n  layers_update(bt);\n  send_dyn(bt);\n);\n\nnev = 0;\nwhile (midirecv(mo, m1, m2, m3)) (\n  nev < EV_MAX ? (\n    ev_base[nev * 4] = mo; ev_base[nev * 4 + 1] = m1; ev_base[nev * 4 + 2] = m2; ev_base[nev * 4 + 3] = m3;\n    nev += 1;\n  ) : midisend(mo, m1, m2, m3);\n);\nei = 0;\nwhile (ei < nev) (\n  mo = ev_base[ei * 4]; m1 = ev_base[ei * 4 + 1]; m2 = ev_base[ei * 4 + 2]; m3 = ev_base[ei * 4 + 3];\n  t_ev = bt + mo * bps;\n  run_to(t_ev);\n  !key_event(t_ev, m1, m2, m3) ? q_add(t_ev, m1, m2, m3);   // everything else passes through\n  ei += 1;\n);\nrun_to(bt_end);\n\n// Sort this block's output by time, note-offs first at a shared moment, then\n// send it and keep it in the take. (Insertion sort: a block holds few.)\ni = 1;\nwhile (i < oq_n) (\n  memcpy(oq_base + OQ_MAX * 4, oq_base + i * 4, 4);\n  k0 = oq_base[OQ_MAX * 4]; s0 = (oq_base[OQ_MAX * 4 + 1] & 0xF0) == 0x90 && oq_base[OQ_MAX * 4 + 3] > 0;\n  j = i - 1;\n  while (j >= 0 && (oq_base[j * 4] > k0 ||\n        (oq_base[j * 4] == k0 && s0 == 0 && (oq_base[j * 4 + 1] & 0xF0) == 0x90 && oq_base[j * 4 + 3] > 0))) (\n    memcpy(oq_base + (j + 1) * 4, oq_base + j * 4, 4);\n    j -= 1;\n  );\n  memcpy(oq_base + (j + 1) * 4, oq_base + OQ_MAX * 4, 4);\n  i += 1;\n);\ni = 0;\nloop(oq_n,\n  midisend(oq_base[i * 4], oq_base[i * 4 + 1], oq_base[i * 4 + 2], oq_base[i * 4 + 3]);\n  rec_add(oq_base[i * 4], oq_base[i * 4 + 1], oq_base[i * 4 + 2], oq_base[i * 4 + 3]);\n  i += 1;\n);\n\ntake_end_req ? ( take_end_req = 0; take_live = 0; take_ready = rec_n > 0; );\nbt = bt_end;\nvt += blk_beats;\ntake_live ? rt += blk_beats;\ni = 0; loop(NL, L_meter[i] *= 0.97; i += 1; );\n\n@serialize\n\n// The take and the window's size are kept with the project, so a take\n// survives closing it. @serialize being non-empty also stops @init from\n// zeroing memory every time the transport starts.\nfile_var(0, init_done);\nfile_var(0, inst_id);\nfile_var(0, ui_zoom);\nfile_var(0, cur_seed);\nfile_var(0, rec_n);\nfile_var(0, take_len);\nfile_var(0, take_qn0);\nfile_var(0, take_tempo);\nfile_var(0, take_num);\nfile_var(0, take_den);\nfile_var(0, take_jumped);\nfile_var(0, take_ready);\nfile_var(0, take_kind);\nfile_var(0, rec_notes);\nrec_n = clampv(rec_n, 0, REC_MAX);\nfile_mem(0, rec_base, rec_n * 4);\n(file_avail(0) >= 0) ? (\n  (ui_zoom < 1 || ui_zoom > 2) ? ui_zoom = 1;\n  rec_on = 0; take_live = 0;\n);\n\n@gfx 860 780\n\n// ================================================================ helpers\nfunction layer_name(L) (\n  L == 0 ? \"Bass\" : L == 1 ? \"Pad\" : L == 2 ? \"Pulse\" : L == 3 ? \"Arpeggio\" : \"Sparkle\";\n);\nfunction layer_role(L) (\n  L == 0 ? \"The lowest key, low down\" :\n  L == 1 ? \"The chord held, its voices drifting\" :\n  L == 2 ? \"Repeated notes that fill in\" :\n  L == 3 ? \"A looping figure that grows\" :\n           \"High notes, now and then\";\n);\nfunction shape_name(s) ( s == 0 ? \"Build\" : s == 1 ? \"Swell\" : s == 2 ? \"Fade\" : \"Wander\" );\n\n// The pointer is over a rectangle - and not over the message bar, which is\n// drawn last and covers anything scrolled underneath it.\nfunction inr(x, y, w, h) (\n  mouse_x >= x && mouse_x < x + w && mouse_y >= y && mouse_y < y + h && mouse_y >= hit_top;\n);\n\n// The system's own typeface where there is one (Transient Shuffler's, via AutoCC).\nfunction pick_font() (\n  gfx_setfont(1, \"Segoe UI\", 14, 0); gfx_getfont(#got);\n  matchi(\"Segoe UI*\", #got) ? strcpy(#ui_font, \"Segoe UI\") : (\n    gfx_setfont(1, \".AppleSystemUIFont\", 14, 0); gfx_getfont(#got);\n    (matchi(\"*System*\", #got) || matchi(\"*SF*\", #got)) ?\n      strcpy(#ui_font, \".AppleSystemUIFont\") : strcpy(#ui_font, \"Arial\");\n  );\n  font_ready = 1;\n);\n\n// Apple's macOS sizes: 13-point text, nothing smaller, everything times ui_s.\nfunction fonts() (\n  gfx_setfont(1, #ui_font, 14 * ui_s, 0);     // buttons, the message bar\n  gfx_setfont(2, #ui_font, 13 * ui_s, 0);     // labels, secondary text\n  gfx_setfont(3, #ui_font, 14 * ui_s, 'b');   // values, layer names, headings\n);\n\nfunction text_fit(str, x, y, w, h) local(tw, th, n, c) (\n  gfx_measurestr(str, tw, th);\n  tw <= w ? (\n    gfx_x = x; gfx_y = y; gfx_drawstr(str, 4, x + w, y + h);\n  ) : (\n    n = strlen(str);\n    while (n > 1 && tw > w) (\n      n -= 1;\n      while (n > 1 && (c = str_getchar(str, n)) >= -128 && c < -64) ( n -= 1; );\n      strcpy_substr(#fit, str, 0, n); strcat(#fit, \"\u00e2\u0080\u00a6\");\n      gfx_measurestr(#fit, tw, th);\n    );\n    gfx_x = x; gfx_y = y; gfx_drawstr(#fit, 4, x + w, y + h);\n  );\n);\n\n// Word-wrapped into lines of width w, lh apart; returns the number of lines.\n// With draw = 0 it only counts.\nfunction wrap_text(str, x, y, w, lh, draw) local(n, s, i, ok, tw, th, lines) (\n  n = strlen(str); s = 0; lines = 0;\n  while (s < n) (\n    while (s < n && str_getchar(str, s) == 32) ( s += 1; );\n    s < n ? (\n      ok = -1; i = s;\n      while (i <= n) (\n        (i == n || str_getchar(str, i) == 32) ? (\n          strcpy_substr(#wl, str, s, i - s);\n          gfx_measurestr(#wl, tw, th);\n          (tw <= w || ok < 0) ? ( ok = i; tw > w ? ( i = n ); ) : ( i = n );\n        );\n        i += 1;\n      );\n      draw ? ( strcpy_substr(#wl, str, s, ok - s); text_fit(#wl, x, y + lines * lh, w, lh); );\n      lines += 1;\n      s = ok;\n    );\n  );\n  max(1, lines);\n);\n\n// A word on a small plate of the view's own ground, so a note under it can\n// never thin its contrast.\nfunction plate_text(str, x, y, c) local(tw, th) (\n  gfx_measurestr(str, tw, th);\n  setx(C_ROLL);\n  gfx_rect(x - 3 * ui_s, y - 1 * ui_s, tw + 6 * ui_s, th + 2 * ui_s, 1);\n  setx(c);\n  gfx_x = x; gfx_y = y;\n  gfx_drawstr(str);\n);\n\n// ---------------------------------------------------------------- keyboard\nfunction focus_add(id, x, y, w, h, kind) local(p) (\n  fl_n < FOCUS_MAX ? (\n    p = focus_base + fl_n * FOCUS_W;\n    p[0] = id; p[1] = x; p[2] = y; p[3] = w; p[4] = h; p[5] = kind;\n    fl_n += 1;\n  );\n);\nfunction focus_ring(x, y, w, h) (\n  setx(C_RING);\n  gfx_rect(x - 3 * ui_s, y - 3 * ui_s, w + 6 * ui_s, h + 6 * ui_s, 0);\n  gfx_rect(x - 2 * ui_s, y - 2 * ui_s, w + 4 * ui_s, h + 4 * ui_s, 0);\n);\nfunction focus_mark(id, x, y, w, h, kind) (\n  reg_on ? focus_add(id, x, y, w, h, kind);\n  focus_id == id ? focus_ring(x, y, w, h);\n);\nfunction key_press(id) (\n  (focus_id == id && (ui_key == 13 || ui_key == 32)) ? ( ui_key = 0; 1; ) : 0;\n);\nfunction key_step(id) local(d) (\n  d = 0;\n  focus_id == id ? (\n    (ui_key == 'up' || ui_key == 'rght') ? ( d = 1;  ui_key = 0; ) :\n    (ui_key == 'down' || ui_key == 'left') ? ( d = -1; ui_key = 0; );\n  );\n  d;\n);\n// What the control just drawn does, shown at the top while it is pointed at\n// or focused. Each hint starts with the control's own name.\nfunction hint(str) (\n  (w_hot || (w_id > 0 && focus_id == w_id)) ? ( hint_on = 1; ui_hint = str; );\n);\nfunction set_status(str) ( strcpy(#status, str); undo_clear_on = 0; );\n\nfunction bwid(label, minw) local(tw, th) (\n  gfx_setfont(1);\n  gfx_measurestr(label, tw, th);\n  max(minw * ui_s, ceil(tw + 24 * ui_s));\n);\nfunction flow(w) local(x) (\n  (flow_x > flow_x0 && flow_x + w > gfx_w - pad) ? ( flow_x = flow_x0; flow_y += ch + gap; );\n  x = flow_x;\n  flow_x += w + gap;\n  x;\n);\nfunction cell(n, cols, cw, y0) (\n  cell_x = pad + (n % cols) * (cw + gap);\n  cell_y = y0 + floor(n / cols) * (fh + gap);\n);\n\n// ---------------------------------------------------------------- controls\n// Light fills on a dark ground, so the ink is C_INK on every button, chosen\n// and unchosen alike; a chosen one also carries an ink bar under its label.\nfunction btn(id, x, y, w, h, label, active) local(hot, held, c) (\n  hot  = inr(x, y, w, h);\n  w_hot = hot; w_id = id;\n  held = hot && (mouse_cap & 1);\n  active ? (\n    c = held ? shade(C_ACCENT, HELD_F) : (hot ? shade(C_ACCENT, HOVER_F) : C_ACCENT);\n  ) : (\n    c = held ? C_CTRL_D : (hot ? C_CTRL_H : C_CTRL);\n  );\n  setx(c);\n  gfx_rect(x, y, w, h, 1);\n  setx(C_INK);\n  gfx_rect(x, y, w, h, 0);\n  gfx_setfont(1);\n  gfx_x = x; gfx_y = y;\n  gfx_drawstr(label, 1 | 4, x + w, y + h);\n  active ? ( setx(C_INK); gfx_rect(x + 10 * ui_s, y + h - 5 * ui_s, w - 20 * ui_s, 2 * ui_s, 1); );\n  focus_mark(id, x, y, w, h, 1);\n  (hot && click) || key_press(id);\n);\n\n// Greys out, leaves the Tab order and stops responding when there is nothing\n// to do. Its dimmed label is the one text exempt from 7:1.\nfunction ubtn(id, x, y, w, h, label, avail) local(hot, held) (\n  hot = avail && inr(x, y, w, h);\n  w_hot = inr(x, y, w, h); w_id = avail ? id : 0;\n  held = hot && (mouse_cap & 1);\n  avail ? setx(held ? C_CTRL_D : (hot ? C_CTRL_H : C_CTRL)) : setx(C_ACTIVE);\n  gfx_rect(x, y, w, h, 1);\n  avail ? setx(C_INK) : setx(C_SEP);\n  gfx_rect(x, y, w, h, 0);\n  avail ? setx(C_INK) : setx(C_DIM);\n  gfx_setfont(1);\n  gfx_x = x; gfx_y = y;\n  gfx_drawstr(label, 1 | 4, x + w, y + h);\n  avail ? focus_mark(id, x, y, w, h, 1);\n  avail && ((hot && click) || key_press(id));\n);\n\n// A setting with a few values: click or Return goes on, right-click goes\n// back, the arrows go either way; all wrap.\nfunction optctl(id, x, y, w, h, label, val, vmx) local(hot, nv, d) (\n  hot = inr(x, y, w, h);\n  w_hot = hot; w_id = id;\n  nv  = val;\n  (hot && click)  ? ( nv = val >= vmx ? 0 : val + 1 );\n  (hot && rclick) ? ( nv = val <= 0 ? vmx : val - 1 );\n  key_press(id)   ? ( nv = val >= vmx ? 0 : val + 1 );\n  d = key_step(id);\n  d > 0 ? ( nv = val >= vmx ? 0 : val + 1 ) : d < 0 ? ( nv = val <= 0 ? vmx : val - 1 );\n  setx(C_SUNK);\n  gfx_rect(x, y, w, h, 1);\n  hot ? setx(C_CTRL) : setx(C_EDGE);\n  gfx_rect(x, y, w, h, 0);\n  setx(C_LABEL2);\n  gfx_setfont(2);\n  gfx_x = x; gfx_y = y + 6 * ui_s;\n  gfx_drawstr(label, 1, x + w, y + 24 * ui_s);\n  focus_mark(id, x, y, w, h, 3);\n  ctl_x = x; ctl_y = y; ctl_w = w; ctl_h = h;\n  fld_val = nv;\n  nv != val;\n);\nfunction ctl_txt(str, c) (\n  gfx_setfont(3);\n  setx(c);\n  gfx_x = ctl_x; gfx_y = ctl_y + 24 * ui_s;\n  gfx_drawstr(str, 1, ctl_x + ctl_w, ctl_y + ctl_h - 2 * ui_s);\n);\n\nfunction fmtval(kind, v) (\n  kind == 2 ? sprintf(#g, \"%d %%\", v) :\n  kind == 5 ? sprintf(#g, v == 1 ? \"%d bar\" : \"%d bars\", v) :\n  kind == 6 ? sprintf(#g, \"%d\", v) :\n  kind == 7 ? ( v > 0 ? sprintf(#g, \"+%d\", v) : v < 0 ? sprintf(#g, \"\u00e2\u0088\u0092%d\", -v) : sprintf(#g, \"0\") ) :\n              sprintf(#g, \"%d\", v);\n);\n\n// A number: drag up or down (Command for fine steps), or focus it and use the\n// arrows (Shift for fine steps). Off (mode 0) it is dimmed and skipped.\nfunction field(id, x, y, w, h, label, val, vmn, vmx, kind, mode, stp, fine) local(hot, nv, d, ed) (\n  ed  = mode == 1;\n  hot = inr(x, y, w, h);\n  w_hot = hot; w_id = ed ? id : 0;\n  (ed && hot && click) ? ( drag_id = id; drag_y = mouse_y; drag_v = val; );\n  nv = val;\n  (ed && drag_id == id && (mouse_cap & 1)) ? (\n    d = (drag_y - mouse_y) * (vmx - vmn) / (150 * ui_s);\n    (mouse_cap & 4) ? ( d *= 0.2 );\n    nv = clampv(floor(drag_v + d + 0.5), vmn, vmx);\n  );\n  d = ed ? key_step(id) : 0;\n  d != 0 ? ( nv = clampv(val + d * ((mouse_cap & 8) ? fine : stp), vmn, vmx); );\n  ed ? setx(C_SUNK) : setx(C_ROLL);\n  gfx_rect(x, y, w, h, 1);\n  (ed && drag_id == id) ? setx(C_ACCENT) : (ed && hot) ? setx(C_CTRL) : ed ? setx(C_EDGE) : setx(C_SEP);\n  gfx_rect(x, y, w, h, 0);\n  mode ? setx(C_LABEL2) : setx(C_DIM);\n  gfx_setfont(2);\n  gfx_x = x; gfx_y = y + 6 * ui_s;\n  gfx_drawstr(label, 1, x + w, y + 24 * ui_s);\n  gfx_setfont(3);\n  ed ? setx(C_TEXT) : mode ? setx(C_LABEL2) : setx(C_DIM);\n  fmtval(kind, nv);\n  gfx_x = x; gfx_y = y + 24 * ui_s;\n  gfx_drawstr(#g, 1, x + w, y + h - 2 * ui_s);\n  ed ? focus_mark(id, x, y, w, h, 2);\n  fld_val = nv;\n  nv != val;\n);\n\n// A line as thick as the interface is large.\nfunction tline(x1, y1, x2, y2) local(j) (\n  j = 0;\n  loop(max(1, floor(ui_s + 0.5)), gfx_line(x1, y1 + j, x2, y2 + j); j += 1; );\n);\n\n// A tick box with a 28-point target; the tick as well as the yellow.\nfunction tickbox(id, x, y, on) local(hot, eb, ex, ey) (\n  hot = inr(x, y, ch, ch);\n  w_hot = hot; w_id = id;\n  eb = 16 * ui_s; ex = x + (ch - eb) / 2; ey = y + (ch - eb) / 2;\n  on ? setx(C_ACCENT) : hot ? setx(C_CTRL_H) : setx(C_CTRL);\n  gfx_rect(ex, ey, eb, eb, 1);\n  setx(C_INK);\n  gfx_rect(ex, ey, eb, eb, 0);\n  on ? (\n    tline(ex + 4 * ui_s, ey + 8 * ui_s, ex + 7 * ui_s, ey + 11 * ui_s);\n    tline(ex + 7 * ui_s, ey + 11 * ui_s, ex + 12 * ui_s, ey + 5 * ui_s);\n  );\n  focus_mark(id, x, y, ch, ch, 4);\n  (hot && click) || key_press(id);\n);\n\n// Sliders written from the window. Each one names its slider, so REAPER\n// shows the change and records it as a change to the project.\nfunction set_slider(n, v) (\n  n == 1 ? ( slider1 = v; sliderchange(slider1); ) :\n  n == 2 ? ( slider2 = v; sliderchange(slider2); ) :\n  n == 3 ? ( slider3 = v; sliderchange(slider3); ) :\n  n == 4 ? ( slider4 = v; sliderchange(slider4); ) :\n  n == 5 ? ( slider5 = v; sliderchange(slider5); ) :\n  n == 6 ? ( slider6 = v; sliderchange(slider6); ) :\n  n == 7 ? ( slider7 = v; sliderchange(slider7); ) :\n  n == 8 ? ( slider8 = v; sliderchange(slider8); ) :\n  n == 9 ? ( slider9 = v; sliderchange(slider9); ) :\n  n == 10 ? ( slider10 = v; sliderchange(slider10); ) :\n  n == 11 ? ( slider11 = v; sliderchange(slider11); ) :\n  n == 12 ? ( slider12 = v; sliderchange(slider12); ) :\n  n == 13 ? ( slider13 = v; sliderchange(slider13); ) :\n  n == 14 ? ( slider14 = v; sliderchange(slider14); ) :\n  n == 15 ? ( slider15 = v; sliderchange(slider15); ) :\n  n == 16 ? ( slider16 = v; sliderchange(slider16); ) :\n  n == 17 ? ( slider17 = v; sliderchange(slider17); ) :\n  n == 18 ? ( slider18 = v; sliderchange(slider18); ) :\n  n == 19 ? ( slider19 = v; sliderchange(slider19); ) :\n  n == 20 ? ( slider20 = v; sliderchange(slider20); ) :\n  n == 21 ? ( slider21 = v; sliderchange(slider21); ) :\n  n == 22 ? ( slider22 = v; sliderchange(slider22); ) :\n  n == 23 ? ( slider23 = v; sliderchange(slider23); ) :\n  n == 24 ? ( slider24 = v; sliderchange(slider24); ) :\n  n == 25 ? ( slider25 = v; sliderchange(slider25); ) :\n  n == 26 ? ( slider26 = v; sliderchange(slider26); ) :\n  n == 27 ? ( slider27 = v; sliderchange(slider27); ) :\n  n == 28 ? ( slider28 = v; sliderchange(slider28); ) :\n  n == 29 ? ( slider29 = v; sliderchange(slider29); ) :\n  n == 30 ? ( slider30 = v; sliderchange(slider30); ) :\n  n == 31 ? ( slider31 = v; sliderchange(slider31); ) :\n  n == 32 ? ( slider32 = v; sliderchange(slider32); ) :\n  n == 33 ? ( slider33 = v; sliderchange(slider33); );\n  apply_sliders();\n  undo_pt = 1;\n);\n\nfunction note_name(p, buf) local(pc) (\n  pc = p % 12;\n  // spelt as ScaleView spells (C#, Eb): Arial, REAPER's fallback, may have no \u00e2\u0099\u00af or \u00e2\u0099\u00ad\n  strcpy(buf, pc == 0 ? \"C\" : pc == 1 ? \"C#\" : pc == 2 ? \"D\" : pc == 3 ? \"Eb\" : pc == 4 ? \"E\" :\n              pc == 5 ? \"F\" : pc == 6 ? \"F#\" : pc == 7 ? \"G\" : pc == 8 ? \"Ab\" : pc == 9 ? \"A\" :\n              pc == 10 ? \"Bb\" : \"B\");\n);\n\n// The take, handed to the helper script through gmem: the events, then the\n// header, then the request number last, so the helper never reads half a take.\nfunction send_take(kind) local(i, n, tr) (\n  n = rec_n;\n  i = 0;\n  loop(n,\n    gmem[G_EVENTS + i * 4]     = rec_base[i * 4];\n    gmem[G_EVENTS + i * 4 + 1] = rec_base[i * 4 + 1];\n    gmem[G_EVENTS + i * 4 + 2] = rec_base[i * 4 + 2];\n    gmem[G_EVENTS + i * 4 + 3] = rec_base[i * 4 + 3];\n    i += 1;\n  );\n  tr = get_host_placement();\n  gmem[G_MAGIC] = ME_MAGIC;\n  gmem[G_KIND] = kind;\n  gmem[G_TRACK] = tr;\n  gmem[G_QN0] = (place_mode == 0 && !take_jumped) ? take_qn0 : -1;\n  gmem[G_COUNT] = n;\n  gmem[G_TEMPO] = take_tempo > 0 ? take_tempo : 120;\n  gmem[G_NUM] = take_num > 0 ? take_num : 4;\n  gmem[G_DEN] = take_den > 0 ? take_den : 4;\n  gmem[G_PLACE] = place_mode;\n  gmem[G_LEN] = take_len;\n  gmem[G_INST] = inst_id;\n  req_id = max(gmem[G_REQ], gmem[G_DONE]) + 1;\n  gmem[G_REQ] = req_id;\n  waiting = 1;\n  wait_t0 = time_precise();\n);\n\n// ================================================================ frame setup\n!font_ready ? pick_font();\n(ui_zoom < 1 || ui_zoom > 2) ? ( ui_zoom = 1 );\n// The layout needs LAYOUT_W points across; a narrower window shrinks a large\n// interface to fit (never below 100%) rather than drawing past its edge.\nLAYOUT_W = 400;\nui_s = max(1, gfx_ext_retina) * max(1, min(ui_zoom, gfx_w / (max(1, gfx_ext_retina) * LAYOUT_W)));\nfonts();\n\nui_key = gfx_getchar();\nclick  = (mouse_cap & 1) && !(last_cap & 1);\nrclick = (mouse_cap & 2) && !(last_cap & 2);\n!(mouse_cap & 1) ? ( drag_id = 0; );\n(click || rclick) ? ( focus_id = 0 );\n\npad = 12 * ui_s;\ngap = 12 * ui_s;\nch  = 28 * ui_s;\nfh  = 48 * ui_s;\n\nmouse_wheel != 0 ? ( scroll -= mouse_wheel / 120 * 48 * ui_s; mouse_wheel = 0; );\nscroll = clampv(scroll, 0, max(0, content_h - gfx_h));\n\n// The helper is running while its heartbeat moves.\nnow_t = time_precise();\ngmem[G_HEART] != hb_last ? ( hb_last = gmem[G_HEART]; hb_seen = now_t; );\nhelper_on = hb_seen > 0 && now_t - hb_seen < 1.5;\n// The helper's answer to our request\n(waiting && gmem[G_DONE] == req_id && gmem[G_DONEINST] == inst_id) ? (\n  waiting = 0;\n  n = clampv(gmem[G_MSGLEN], 0, 600);\n  strcpy(#status, \"\");\n  i = 0;\n  loop(n, str_setchar(#status, i, gmem[G_MSG + i]); i += 1; );\n  undo_clear_on = 0;\n);\n(waiting && now_t - wait_t0 > 3) ? (\n  waiting = 0;\n  set_status(\"The helper didn\u00e2\u0080\u0099t answer. In REAPER\u00e2\u0080\u0099s Actions list, run \u00e2\u0080\u009cMidi Evolver Helper\u00e2\u0080\u009d, then try again.\");\n);\n\n// the ground behind everything (docs/COLOUR.md)\nsetx(C_GROUND);\ngfx_rect(0, 0, gfx_w, gfx_h, 1);\n\nfl_n = 0; reg_on = 1; hint_on = 0;\n\n// The message bar is drawn last, over anything scrolled beneath it, but it\n// comes first in the Tab order, so its buttons are registered now.\nstatus_on = strlen(#status) > 0;\nopt_w = bwid(\"Options\", 84);\nopt_x = gfx_w - pad - opt_w;\ndis_w = bwid(\"Dismiss\", 84);\ndis_x = opt_x - gap - dis_w;\nund_w = bwid(\"Undo\", 64);\nund_x = dis_x - gap - und_w;\nmsg_r = (status_on ? (undo_clear_on ? und_x : dis_x) : opt_x) - gap;\ngfx_setfont(1);\nbar_lh = gfx_texth + 2 * ui_s;\nbar_under = und_x - gap - pad < 240 * ui_s;\nbar_x = pad;\nbar_w = bar_under ? gfx_w - 2 * pad : msg_r - pad;\nbar_y = bar_under ? pad + ch + 6 * ui_s : pad;\nnw = bar_under ? bar_w : und_x - gap - pad;\nbar_n = max(wrap_text(\"The helper didn\u00e2\u0080\u0099t answer. In REAPER\u00e2\u0080\u0099s Actions list, run \u00e2\u0080\u009cMidi Evolver Helper\u00e2\u0080\u009d, then try again.\", 0, 0, nw, bar_lh, 0),\n            max(wrap_text(#status, 0, 0, nw, bar_lh, 0), wrap_text(#bar_last, 0, 0, nw, bar_lh, 0)));\nbar_h = bar_under ? bar_n * bar_lh : max(ch, bar_n * bar_lh);\ntop_h = bar_y + bar_h + 8 * ui_s;\n(status_on && undo_clear_on) ? focus_add(114, und_x, pad, und_w, ch, 1);\nstatus_on ? focus_add(113, dis_x, pad, dis_w, ch, 1);\nfocus_add(110, opt_x, pad, opt_w, ch, 1);\n\nhit_top = top_h;\ny = top_h + 4 * ui_s - scroll;\nbb = bar_beats();\n\n// ---------------------------------------------------------------- 1. Motion\n// What is playing now, the last two bars of it, and where the hold is on its\n// energy curve.\ngfx_setfont(3);\nsetx(C_TEXT);\ngfx_x = pad; gfx_y = y;\ngfx_drawstr(\"Motion\");\ngfx_setfont(2);\nholding ? (\n  strcpy(#mh, \"Holding \");\n  i = 0;\n  loop(min(ch_n, 8), note_name(ch_base[i], #nn); strcat(#mh, #nn); i < min(ch_n, 8) - 1 ? strcat(#mh, \" \"); i += 1; );\n  na = 0; i = 0; loop(NL, L_act[i] ? na += 1; i += 1; );\n  sprintf(#nn, \" \u00e2\u0080\u0094 %d of %d layers playing\", na, L_on[0] + L_on[1] + L_on[2] + L_on[3] + L_on[4]);\n  strcat(#mh, #nn);\n) : (\n  strcpy(#mh, \"Hold some keys to start.\");\n);\ngfx_measurestr(\"Motion\", tw, th);\ngfx_setfont(3); gfx_measurestr(\"Motion\", tw, th);\ngfx_setfont(2);\nsetx(holding ? C_TEXT : C_LABEL2);\ntext_fit(#mh, pad + tw + 12 * ui_s, y, gfx_w - 2 * pad - tw - 12 * ui_s, th);\ny += th + 6 * ui_s;\n\nvx = pad; vw = gfx_w - 2 * pad; vh = 132 * ui_s; vy = y;\nsetx(C_ROLL);\ngfx_rect(vx, vy, vw, vh, 1);\nsetx(C_SEP);\ngfx_rect(vx, vy, vw, vh, 0);\n// the window: the last two bars, now at the right edge\nwin = 2 * bb;\nt1 = vt; t0 = vt - win;\n// beat and bar lines, counted from where the grid starts\nk = ceil((t0 - origin) / 1);\nwhile (origin + k <= t1) (\n  gx = vx + (origin + k - t0) / win * vw;\n  setx(fmodp(k, bb) == 0 ? C_SEP : C_BEAT);\n  gfx_line(gx, vy + 1, gx, vy + vh - 2);\n  k += 1;\n);\n// the pitch range of what is in view, at least two octaves\nlo = 128; hi = -1; i = 0;\nloop(roll_n,\n  r = roll_base + i * 5;\n  (r[2] < 0 || r[2] > t0) ? ( lo = min(lo, r[0]); hi = max(hi, r[0]); );\n  i += 1;\n);\nhi < lo ? ( lo = 48; hi = 84; );\n(hi - lo < 24) ? ( mid = (hi + lo) / 2; lo = floor(mid - 12); hi = ceil(mid + 12); );\nnh = clampv((vh - 8 * ui_s) / (hi - lo + 1), 3 * ui_s, 10 * ui_s);\ni = 0;\nloop(roll_n,\n  r = roll_base + i * 5;\n  (r[2] < 0 || r[2] > t0) ? (\n    x1 = vx + max(0, (r[1] - t0) / win) * vw;\n    x2 = vx + ((r[2] < 0 ? t1 : min(r[2], t1)) - t0) / win * vw;\n    yy = vy + 4 * ui_s + (hi - r[0]) * (vh - 8 * ui_s - nh) / max(1, hi - lo);\n    (r[2] < 0 && holding) ? setx(C_ACCENT) : setx(C_CTRL);\n    gfx_rect(x1, yy, max(2 * ui_s, x2 - x1 - 1), max(2 * ui_s, nh - 1), 1);\n  );\n  i += 1;\n);\n!holding && roll_n == 0 ? (\n  gfx_setfont(2);\n  gfx_measurestr(\"Hold some keys and the music they start appears here.\", tw, th);\n  plate_text(\"Hold some keys and the music they start appears here.\", vx + (vw - tw) / 2, vy + (vh - th) / 2, C_LABEL2);\n);\nw_hot = inr(vx, vy, vw, vh); w_id = 0;\nhint(\"Motion: the last two bars of what Midi Evolver played. Notes sounding now are yellow.\");\ny += vh + 8 * ui_s;\n\n// The energy strip: the shape over two paces, the layers' entry levels, and\n// where the hold is now.\neh = 40 * ui_s; ey = y;\nsetx(C_ROLL);\ngfx_rect(vx, ey, vw, eh, 1);\nsetx(C_SEP);\ngfx_rect(vx, ey, vw, eh, 0);\ni = 0;\nloop(NL,\n  L_on[i] && L_th[i] > 0 ? (\n    setx(C_EDGE);\n    gy = ey + eh - 3 * ui_s - L_th[i] * (eh - 6 * ui_s);\n    gfx_line(vx + 1, gy, vx + 6 * ui_s, gy);\n    gfx_line(vx + vw - 6 * ui_s, gy, vx + vw - 2, gy);\n  );\n  i += 1;\n);\nu_now = holding ? (vt - hold_vt0) / (pace * bb) : 0;\nu_base = shape == 3 ? floor(u_now / 2) * 2 : 0;\nsetx(C_LABEL2);\npx = 0; lpx = 0; lpy = 0;\nwhile (px <= vw - 2 * ui_s) (\n  uu = u_base + px / (vw - 2 * ui_s) * 2;\n  ev = shape_at(uu, holding ? seed_now : 0);\n  py = ey + eh - 3 * ui_s - ev * (eh - 6 * ui_s);\n  px > 0 ? tline(vx + lpx, lpy, vx + 1 + px, py);\n  lpx = 1 + px; lpy = py;\n  px += 2 * ui_s;\n);\nholding ? (\n  ux = vx + 1 + clampv((u_now - u_base) / 2, 0, 1) * (vw - 2 * ui_s);\n  setx(C_PLAY);\n  gfx_line(ux, ey + 2, ux, ey + eh - 3);\n  setx(C_ACCENT);\n  gfx_circle(ux, ey + eh - 3 * ui_s - e_now * (eh - 6 * ui_s), 4 * ui_s, 1, 1);\n);\ngfx_setfont(2);\nplate_text(\"Energy\", vx + 8 * ui_s, ey + 4 * ui_s, C_LABEL2);\nw_hot = inr(vx, ey, vw, eh); w_id = 0;\nhint(\"Energy: how much is going on over two paces of holding. The marks at the sides are where each layer comes in.\");\ny += eh + gap + 4 * ui_s;\n\n// ---------------------------------------------------------------- 2. Evolution\ngfx_setfont(3);\nsetx(C_TEXT);\ngfx_x = pad; gfx_y = y;\ngfx_drawstr(\"Evolution\");\ny += gfx_texth + 8 * ui_s;\n\nflow_x0 = pad; flow_x = pad; flow_y = y;\nbw = max(max(bwid(\"Build\", 80), bwid(\"Swell\", 80)), max(bwid(\"Fade\", 80), bwid(\"Wander\", 80)));\nbx = flow(bw); btn(101, bx, flow_y, bw, ch, \"Build\", shape == 0) ? set_slider(1, 0);\nhint(\"Build: starts quietly and grows over the pace, then keeps evolving at the top.\");\nbx = flow(bw); btn(102, bx, flow_y, bw, ch, \"Swell\", shape == 1) ? set_slider(1, 1);\nhint(\"Swell: grows over the pace and falls back over the next, again and again.\");\nbx = flow(bw); btn(103, bx, flow_y, bw, ch, \"Fade\", shape == 2) ? set_slider(1, 2);\nhint(\"Fade: starts at its fullest and thins out over the pace.\");\nbx = flow(bw); btn(104, bx, flow_y, bw, ch, \"Wander\", shape == 3) ? set_slider(1, 3);\nhint(\"Wander: rises and falls unpredictably, at a speed set by the pace.\");\npw = bwid(\"Panic\", 80);\nflow_x <= gfx_w - pad - pw ? ( bx = gfx_w - pad - pw; ) : ( bx = flow(pw); );\nbtn(105, bx, flow_y, pw, ch, \"Panic\", 0) ? (\n  panic_req = 1;\n  set_status(\"Panic \u00e2\u0080\u0094 every note Midi Evolver started has been stopped.\");\n);\nhint(\"Panic: stop every note Midi Evolver started, and forget the keys held.\");\ny = flow_y + ch + gap;\n\nfcols = clampv(floor((gfx_w - 2 * pad + gap) / (118 * ui_s + gap)), 2, 6);\nfw = floor((gfx_w - 2 * pad - (fcols - 1) * gap) / fcols);\nfy0 = y;\ncell(0, fcols, fw, fy0);\nfield(1, cell_x, cell_y, fw, fh, \"Pace\", slider2, 1, 64, 5, 1, 1, 1) ? set_slider(2, fld_val);\nhint(\"Pace: how many bars the evolution takes to grow. Fewer bars evolve faster.\");\ncell(1, fcols, fw, fy0);\nfield(2, cell_x, cell_y, fw, fh, \"Change\", slider3, 0, 100, 2, 1, 5, 1) ? set_slider(3, fld_val);\nhint(\"Change: how much the patterns themselves change as they go round. 0% keeps them as they began.\");\ncell(2, fcols, fw, fy0);\nfield(3, cell_x, cell_y, fw, fh, \"Start\", slider4, 0, 100, 2, 1, 5, 1) ? (\n  set_slider(4, fld_val); slider5 < slider4 ? set_slider(5, slider4); );\nhint(\"Start: how much is going on the moment you press the keys.\");\ncell(3, fcols, fw, fy0);\nfield(4, cell_x, cell_y, fw, fh, \"Peak\", slider5, 0, 100, 2, 1, 5, 1) ? (\n  set_slider(5, fld_val); slider4 > slider5 ? set_slider(4, slider5); );\nhint(\"Peak: how far it grows. Below 100% the last layers may never come in.\");\ncell(4, fcols, fw, fy0);\nfield(5, cell_x, cell_y, fw, fh, \"Feel\", slider8, 0, 100, 2, 1, 5, 1) ? set_slider(8, fld_val);\nhint(\"Feel: how far the timing and loudness wander, the way nobody plays a figure twice alike.\");\ncell(5, fcols, fw, fy0);\noptctl(6, cell_x, cell_y, fw, fh, \"Variation\", slider6, 1) ? (\n  fld_val ? (\n    set_slider(7, cur_seed); set_slider(6, 1);\n    sprintf(#status, \"Locked to variation %d \u00e2\u0080\u0094 every hold now starts the same way. Your playing still steers it.\", cur_seed);\n  ) : (\n    set_slider(6, 0);\n    set_status(\"Every hold is a new variation again.\");\n  );\n);\nslider6 ? ( sprintf(#g, \"Locked: %d\", slider7); ctl_txt(#g, C_TEXT); ) : ctl_txt(\"New Each Time\", C_TEXT);\nhint(\"Variation: a new one each time you hold, or locked to the last one so you can play it again.\");\ny = fy0 + ceil(6 / fcols) * (fh + gap);\n\n// ---------------------------------------------------------------- 3. Layers\ngfx_setfont(3);\nsetx(C_TEXT);\ngfx_x = pad; gfx_y = y;\ngfx_drawstr(\"Layers\");\ngfx_setfont(2);\nsetx(C_LABEL2);\ngfx_x += 12 * ui_s;\ngfx_measurestr(\"Layers\", tw, th);\ntext_fit(\"They come in from the top down as the energy rises.\", pad + tw + 24 * ui_s, y, gfx_w - 2 * pad - tw - 24 * ui_s, th);\ny += th + 8 * ui_s;\n\n// A row: the box and the name, then Channel, Octave and Level; the fields go\n// under the name when the window is too narrow for one line, and the words\n// wrap rather than being cut short.\nfwl = 84 * ui_s;\ngfx_setfont(2);\nlh3 = gfx_texth + 2 * ui_s;\nL = 0;\nloop(NL,\n  !L_on[L] ? strcpy(#ls, \"Off\") :\n  (L_act[L] && holding) ? sprintf(#ls, \"%s \u00e2\u0080\u0094 playing\", layer_role(L)) :\n  // (at once: the shape starts at or above where it comes in)\n  L_th[L] <= shape_at(0, 0) + 0.0001 ? sprintf(#ls, \"%s \u00e2\u0080\u0094 comes in at once\", layer_role(L)) :\n                 sprintf(#ls, \"%s \u00e2\u0080\u0094 comes in at %d%%\", layer_role(L), floor(L_th[L] * 100 + 0.5));\n  ry = y; rx = pad; rw = gfx_w - 2 * pad;\n  nx = rx + 6 * ui_s + ch + 8 * ui_s;\n  one_line = rw - (nx - rx) - 3 * (fwl + gap) - 12 * ui_s >= 150 * ui_s;\n  nwid = one_line ? rw - (nx - rx) - 3 * (fwl + gap) - 12 * ui_s : rw - (nx - rx) - 16 * ui_s;\n  gfx_setfont(2);\n  nlines = wrap_text(#ls, 0, 0, nwid, lh3, 0);\n  texth_ = 4 * ui_s + 18 * ui_s + nlines * lh3;\n  rowh = one_line ? max(fh + 12 * ui_s, texth_ + 6 * ui_s) : texth_ + 8 * ui_s + fh + 12 * ui_s;\n  setx(L_act[L] && holding ? C_ACTIVE : C_POPUP);\n  gfx_rect(rx, ry, rw, rowh, 1);\n  (L_act[L] && holding) ? ( setx(C_ACCENT); gfx_rect(rx, ry, 3 * ui_s, rowh, 1); );\n  bxh = rx + 6 * ui_s; byh = ry + 4 * ui_s;\n  tickbox(200 + L, bxh, byh, L_on[L]) ? (\n    set_slider(9 + L, L_on[L] ? 0 : 1);\n  );\n  hint(\"On or off: a layer that\u00e2\u0080\u0099s off never plays. The layers that are on come in from the top down.\");\n  // name, then what it does and whether it plays\n  gfx_setfont(3);\n  setx(L_on[L] ? C_TEXT : C_LABEL2);\n  text_fit(layer_name(L), nx, byh + 2 * ui_s, nwid, 16 * ui_s);\n  gfx_setfont(2);\n  setx(L_act[L] && holding ? C_TEXT : C_LABEL2);\n  wrap_text(#ls, nx, byh + 20 * ui_s, nwid, lh3, 1);\n  // the meter: how loud its last note was\n  mx_ = rx + rw - 8 * ui_s; mh_ = rowh - 16 * ui_s;\n  setx(C_ROLL); gfx_rect(mx_, ry + 8 * ui_s, 4 * ui_s, mh_, 1);\n  lv = clampv(L_meter[L], 0, 1);\n  lv > 0.02 ? ( setx(C_ACCENT); gfx_rect(mx_, ry + 8 * ui_s + mh_ * (1 - lv), 4 * ui_s, mh_ * lv, 1); );\n  // the fields\n  fx0 = one_line ? rx + rw - 12 * ui_s - 3 * (fwl + gap) + gap : nx;\n  fyy = one_line ? ry + 6 * ui_s : ry + texth_ + 8 * ui_s;\n  field(210 + L, fx0, fyy, fwl, fh, \"Channel\", L_ch[L] + 1, 1, 16, 6, L_on[L], 1, 1) ? set_slider(14 + L, fld_val);\n  hint(\"Channel: the MIDI channel this layer plays on, so each can go to its own instrument.\");\n  field(220 + L, fx0 + fwl + gap, fyy, fwl, fh, \"Octave\", L_oct[L], -2, 2, 7, L_on[L], 1, 1) ? set_slider(19 + L, fld_val);\n  hint(\"Octave: move this layer up or down by octaves.\");\n  field(230 + L, fx0 + 2 * (fwl + gap), fyy, fwl, fh, \"Level\", floor(L_lvl[L] * 100 + 0.5), 0, 100, 2, L_on[L], 5, 1) ? set_slider(24 + L, fld_val);\n  hint(\"Level: how loud this layer plays, from silent to full.\");\n  y += rowh + 4 * ui_s;\n  L += 1;\n);\ny += gap - 4 * ui_s;\n\n// ---------------------------------------------------------------- 4. Recorder\ngfx_setfont(3);\nsetx(C_TEXT);\ngfx_x = pad; gfx_y = y;\ngfx_drawstr(\"Recorder\");\ny += gfx_texth + 8 * ui_s;\nflow_x0 = pad; flow_x = pad; flow_y = y;\nlbl = rec_on ? \"Recording\" : \"Record\";\nbw = max(bwid(\"Record\", 96), bwid(\"Recording\", 96)); bx = flow(bw);\nbtn(120, bx, flow_y, bw, ch, lbl, rec_on) ? (\n  rec_req = 1;\n  rec_on ? set_status(\"Stopped recording. Drag Out or Insert puts the take in your project.\")\n         : set_status(\"Recording \u00e2\u0080\u0094 every hold from now on goes into one take, with the pauses between. Click Recording to stop.\");\n);\nhint(\"Record: keep every hold in one take until you click again. Without it, the take is your last hold.\");\nbw = bwid(\"Clear\", 72); bx = flow(bw);\nubtn(121, bx, flow_y, bw, ch, \"Clear\", rec_n > 0 && !take_live) ? (\n  clear_n = rec_n; clear_len = take_len; clear_ready = take_ready;\n  clear_notes = rec_notes; clear_kind = take_kind;\n  rec_n = 0; rec_notes = 0; take_ready = 0; take_kind = 0;\n  set_status(\"Cleared the take.\");\n  undo_clear_on = 1;\n);\nhint(\"Clear: throw the take away. Undo brings it back.\");\nbw = bwid(\"Drag Out\u00e2\u0080\u00a6\", 104); bx = flow(bw);\nubtn(122, bx, flow_y, bw, ch, \"Drag Out\u00e2\u0080\u00a6\", take_ready && !take_live && !waiting) ? (\n  send_take(1);\n  !helper_on ? set_status(\"Drag Out needs the helper. In REAPER\u00e2\u0080\u0099s Actions list, run \u00e2\u0080\u009cMidi Evolver Helper\u00e2\u0080\u009d, then click Drag Out again.\");\n);\nhint(\"Drag Out: save the take as a MIDI file and show it in REAPER\u00e2\u0080\u0099s Media Explorer, to drag onto any track.\");\nbw = bwid(\"Insert\", 80); bx = flow(bw);\nubtn(123, bx, flow_y, bw, ch, \"Insert\", take_ready && !take_live && !waiting) ? (\n  send_take(2);\n  !helper_on ? set_status(\"Insert needs the helper. In REAPER\u00e2\u0080\u0099s Actions list, run \u00e2\u0080\u009cMidi Evolver Helper\u00e2\u0080\u009d, then click Insert again.\");\n);\nhint(\"Insert: put the take on this track as a new MIDI item, where it was played or at the edit cursor.\");\ny = flow_y + ch + gap;\n\ngcols = clampv(floor((gfx_w - 2 * pad + gap) / (150 * ui_s + gap)), 1, 4);\ngw = floor((gfx_w - 2 * pad - (gcols - 1) * gap) / gcols);\ncell(0, gcols, gw, y);\noptctl(124, cell_x, cell_y, gw, fh, \"Place Take\", slider33, 1) ? set_slider(33, fld_val);\nctl_txt(slider33 ? \"At Edit Cursor\" : \"Where Played\", C_TEXT);\nhint(\"Place Take: where Insert puts it \u00e2\u0080\u0094 where it was played (if REAPER was playing then), or at the edit cursor.\");\ny += fh + 8 * ui_s;\n\n// what is in the take, and whether the helper is there\ngfx_setfont(2);\nlh2 = gfx_texth + 3 * ui_s;\ntake_live ? (\n  sprintf(#ti, \"%s %.1f bars so far, %d notes.\", take_kind == 2 ? \"Recording:\" : \"Keeping this hold:\", max(0, rt) / bb, rec_notes);\n) : (take_ready && take_kind == 2) ? (\n  sprintf(#ti, \"The take: %.1f bars, %d notes, recorded. New holds aren\u00e2\u0080\u0099t kept until you clear it or record again.\", take_len / bb, rec_notes);\n) : take_ready ? (\n  sprintf(#ti, \"The take: your last hold, %.1f bars, %d notes. The next hold replaces it.\", take_len / bb, rec_notes);\n) : (\n  strcpy(#ti, rec_on ? \"Recording \u00e2\u0080\u0094 hold some keys.\" : \"No take yet. Your last hold is kept until the next one.\");\n);\nsetx(C_TEXT);\ny += wrap_text(#ti, pad, y, gfx_w - 2 * pad, lh2, 1) * lh2;\nsetx(C_LABEL2);\nhelper_on ? strcpy(#hl, \"The helper is running: Drag Out and Insert are ready.\")\n          : strcpy(#hl, \"Drag Out and Insert need the helper: run \u00e2\u0080\u009cMidi Evolver Helper\u00e2\u0080\u009d from REAPER\u00e2\u0080\u0099s Actions list. It stays running until REAPER closes.\");\ny += wrap_text(#hl, pad, y, gfx_w - 2 * pad, lh2, 1) * lh2;\ny += gap;\n\n// ---------------------------------------------------------------- 5. MIDI\ngfx_setfont(3);\nsetx(C_TEXT);\ngfx_x = pad; gfx_y = y;\ngfx_drawstr(\"MIDI\");\ny += gfx_texth + 8 * ui_s;\ngcols = clampv(floor((gfx_w - 2 * pad + gap) / (130 * ui_s + gap)), 2, 4);\ngw = floor((gfx_w - 2 * pad - (gcols - 1) * gap) / gcols);\ngy0 = y;\ncell(0, gcols, gw, gy0);\noptctl(130, cell_x, cell_y, gw, fh, \"Keys From\", slider29, 16) ? set_slider(29, fld_val);\nslider29 > 0 ? ( sprintf(#g, \"Channel %d\", slider29); ctl_txt(#g, C_TEXT); ) : ctl_txt(\"Any Channel\", C_TEXT);\nhint(\"Keys From: listen to keys on any channel, or on one. Right-click steps back.\");\ncell(1, gcols, gw, gy0);\noptctl(131, cell_x, cell_y, gw, fh, \"Held Keys\", slider30, 1) ? set_slider(30, fld_val);\nctl_txt(slider30 ? \"Played\" : \"Muted\", C_TEXT);\nhint(\"Held Keys: Muted lets only Midi Evolver play; Played lets your own keys through too.\");\ncell(2, gcols, gw, gy0);\noptctl(132, cell_x, cell_y, gw, fh, \"Sustain Pedal\", slider31, 1) ? set_slider(31, fld_val);\nctl_txt(slider31 ? \"Holds Keys\" : \"Ignored\", C_TEXT);\nhint(\"Sustain Pedal: Holds Keys keeps the chord evolving after you let go, until the pedal comes up.\");\ncell(3, gcols, gw, gy0);\noptctl(133, cell_x, cell_y, gw, fh, \"Dynamics\", slider32, 3) ? set_slider(32, fld_val);\nctl_txt(slider32 == 0 ? \"Off\" : slider32 == 1 ? \"CC1\" : slider32 == 2 ? \"CC11\" : \"CC1 and CC11\", C_TEXT);\nhint(\"Dynamics: also send the energy as CC1 or CC11, for sample libraries that swell with the mod wheel.\");\ny = gy0 + ceil(4 / gcols) * (fh + gap);\n\ncontent_h = y - gap + pad + scroll;\ncontent_h > gfx_h ? (\n  setx(C_SEP);\n  gfx_rect(gfx_w - 5 * ui_s, top_h, 3 * ui_s, gfx_h - top_h, 1);\n  setx(C_EDGE);\n  gfx_rect(gfx_w - 5 * ui_s, top_h + (gfx_h - top_h) * scroll / content_h,\n           3 * ui_s, max(12 * ui_s, (gfx_h - top_h) * gfx_h / content_h), 1);\n);\n\n// ---------------------------------------------------------------- message bar\n// At the top, never the bottom: a message, else what the control under the\n// pointer or the focus does, else what to do. A message stays until Dismiss\n// or until another replaces it.\nhit_top = 0; reg_on = 0;\nsetx(C_GROUND);\ngfx_rect(0, 0, gfx_w, top_h, 1);\nsetx(C_SEP);\ngfx_line(0, top_h - 1, gfx_w, top_h - 1);\n\n(status_on && undo_clear_on) ? (\n  btn(114, und_x, pad, und_w, ch, \"Undo\", 0) ? (\n    rec_n = clear_n; take_len = clear_len; take_ready = clear_ready; rec_notes = clear_notes; take_kind = clear_kind;\n    set_status(\"The take is back.\");\n  );\n  hint(\"Undo: bring back the take you cleared.\");\n);\nstatus_on ? (\n  btn(113, dis_x, pad, dis_w, ch, \"Dismiss\", 0) ? ( strcpy(#status, \"\"); undo_clear_on = 0; );\n  hint(\"Dismiss: clear this message.\");\n);\nbtn(110, opt_x, pad, opt_w, ch, \"Options\", 0) ? (\n  gfx_x = opt_x; gfx_y = pad + ch;\n  sprintf(#menu, \"%sInterface Size 100%%|%sInterface Size 125%%|%sInterface Size 150%%|%sInterface Size 200%%\",\n          ui_zoom == 1 ? \"!\" : \"\", ui_zoom == 1.25 ? \"!\" : \"\", ui_zoom == 1.5 ? \"!\" : \"\", ui_zoom == 2 ? \"!\" : \"\");\n  menu_sel = gfx_showmenu(#menu);\n  menu_sel == 1 ? ( ui_zoom = 1 ) : menu_sel == 2 ? ( ui_zoom = 1.25 ) :\n  menu_sel == 3 ? ( ui_zoom = 1.5 ) : menu_sel == 4 ? ( ui_zoom = 2 );\n  menu_sel > 0 ? undo_pt = 1;\n);\nhint(\"Options: choose the interface size, from 100% to 200% (smaller when the window is too narrow).\");\n\ngfx_setfont(1);\nstrlen(#status) > 0 ? (\n  setx(C_TEXT); strcpy(#bar_last, #status);\n) : hint_on ? (\n  setx(C_LABEL2); strcpy(#bar_last, ui_hint);\n) : (L_on[0] + L_on[1] + L_on[2] + L_on[3] + L_on[4]) == 0 ? (\n  setx(C_WARN_TEXT); strcpy(#bar_last, \"Every layer is off, so holding keys plays nothing. Turn a layer on.\");\n) : (\n  setx(C_LABEL2); strcpy(#bar_last, \"Hold a chord and let it grow. Press Tab to move by keyboard.\");\n);\nbar_n = wrap_text(#bar_last, 0, 0, bar_w, bar_lh, 0);\nwrap_text(#bar_last, bar_x, bar_y + max(0, bar_h - bar_n * bar_lh) / 2, bar_w, bar_lh, 1);\n\n// ---------------------------------------------------------------- keys\nui_key == 9 ? (\n  fl_n > 0 ? (\n    cur = -1; i = 0;\n    loop(fl_n, focus_base[i * FOCUS_W] == focus_id ? ( cur = i ); i += 1; );\n    (mouse_cap & 8) ? ( cur = cur <= 0 ? fl_n - 1 : cur - 1 )\n                    : ( cur = cur < 0 ? 0 : (cur + 1) % fl_n );\n    focus_id = focus_base[cur * FOCUS_W];\n    (focus_id != 110 && focus_id != 113 && focus_id != 114) ? (\n      fy_ = focus_base[cur * FOCUS_W + 2]; fh_ = focus_base[cur * FOCUS_W + 4];\n      fy_ < top_h + 6 * ui_s ? ( scroll -= top_h + 6 * ui_s - fy_ ) :\n      fy_ + fh_ > gfx_h - 6 * ui_s ? ( scroll += fy_ + fh_ - gfx_h + 6 * ui_s );\n    );\n  );\n) : ui_key == 27 ? ( focus_id = 0 );\n\n// sliderchange(-1) from @gfx asks REAPER for a project undo point; deferred\n// to mouse-up so one gesture is one point.\n(undo_pt && !(mouse_cap & 1)) ? ( sliderchange(-1); undo_pt = 0; );\n\nlast_cap = mouse_cap;\n"};

/* ---- kit/runtime/jsfx.js ---- */
/* Middaw's JSFX runtime: the family's REAPER plug-ins, run unchanged.
 *
 * A JSFX file is a header (sliders, pins, imports) and sections of EEL2 code:
 * @init, @slider, @block, @sample, @serialize and @gfx. This file reads the
 * header, compiles the EEL2 in each section to JavaScript, and runs it the way
 * REAPER does: @init once, @slider when a slider moves, then for every block
 * @block once and @sample once per sample frame. MIDI arrives through
 * midirecv() and leaves through midisend() with its sample offset.
 *
 * @gfx is not run by default: Middaw draws each device's controls itself from
 * the sliders, so a device looks like the rest of the app. With
 * `{ gfx: true }` it is compiled too, and `runGfx(host, ...)` runs it: every
 * gfx_* call goes to the host, which draws (the Ableton devices' [v8ui]).
 *
 * Everything in EEL2 is a double. Variables live in one Float64Array, so the
 * generated code reads `v[12]`; memory (`buf[i]`) is EEL2's 8M words, given
 * out in 64k-word blocks only when written to, as EEL2 itself does.
 */
(function (NS) {
  'use strict';

  var EPS = 0.00001;
  var MAXLOOP = 1048576;
  var BLOCK = 65536, NBLOCKS = 128;

  // ------------------------------------------------------------ header ----
  function parseSliderLine(line) {
    var m = /^slider(\d+):(?:([A-Za-z_][\w.]*)=)?\s*([^<]*?)\s*<([^>]*)>(.*)$/.exec(line);
    if (!m) return null;
    var inner = m[4], enumNames = null;
    var em = /\{([^}]*)\}/.exec(inner);
    if (em) { enumNames = em[1].split(','); inner = inner.replace(em[0], ''); }
    var shape = null, sm = /:(log|sqr)(?:=([^,>]*))?/.exec(inner);
    if (sm) { shape = { kind: sm[1], value: sm[2] === undefined ? null : Number(sm[2]) }; inner = inner.replace(sm[0], ''); }
    var parts = inner.split(',').map(function (s) { return s.trim(); });
    var desc = m[5].trim();
    var hidden = desc[0] === '-';
    if (hidden) desc = desc.slice(1);
    return {
      index: Number(m[1]), variable: (m[2] || ('slider' + m[1])).toLowerCase(),
      def: Number(m[3]) || 0, min: Number(parts[0]) || 0, max: parts[1] === undefined ? 1 : Number(parts[1]),
      step: parts[2] === undefined || parts[2] === '' ? 0 : Number(parts[2]),
      names: enumNames, shape: shape, name: desc, hidden: hidden
    };
  }

  // A JSFX file and its imports -> header and sections.
  function parseFile(text, readImport) {
    var out = { desc: '', sliders: [], inPins: [], outPins: [], options: '', sections: {}, gfxSize: null };
    var order = ['init', 'slider', 'block', 'sample', 'serialize', 'gfx'];
    order.forEach(function (s) { out.sections[s] = []; });
    function take(src, isImport) {
      var lines = src.replace(/\r\n?/g, '\n').split('\n');
      var section = null, buf = [], startLine = 0;
      function flush() {
        if (section && out.sections[section]) out.sections[section].push({ code: buf.join('\n'), line: startLine });
        buf = [];
      }
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var sm = /^@(\w+)(.*)$/.exec(line);
        if (sm) {
          flush();
          section = sm[1].toLowerCase();
          startLine = i + 2;
          if (section === 'gfx') {
            var sz = sm[2].trim().split(/\s+/).map(Number);
            if (sz.length >= 2 && !out.gfxSize) out.gfxSize = [sz[0], sz[1]];
          }
          continue;
        }
        if (section) { buf.push(line); continue; }
        var t = line.trim();
        if (/^desc:/.test(t)) { if (!isImport || !out.desc) out.desc = t.slice(5).trim(); }
        else if (/^slider\d+:/.test(t)) { var s = parseSliderLine(t); if (s) out.sliders.push(s); }
        else if (/^in_pin:/.test(t)) out.inPins.push(t.slice(7).trim());
        else if (/^out_pin:/.test(t)) out.outPins.push(t.slice(8).trim());
        else if (/^options:/.test(t)) out.options += ' ' + t.slice(8).trim();
        else if (/^import\s+/.test(t)) {
          var name = t.replace(/^import\s+/, '').trim();
          var inc = readImport ? readImport(name) : null;
          if (inc === null || inc === undefined) throw new Error('JSFX import not found: ' + name);
          take(inc, true);
        }
      }
      flush();
    }
    take(text, false);
    out.sliders.sort(function (a, b) { return a.index - b.index; });
    out.inPins = out.inPins.filter(function (p) { return p !== 'none'; });
    out.outPins = out.outPins.filter(function (p) { return p !== 'none'; });
    return out;
  }

  // ------------------------------------------------------------- lexer ----
  var OPS = ['===', '!==', '<<=', '>>=', '==', '!=', '<=', '>=', '<<', '>>', '&&', '||',
    '+=', '-=', '*=', '/=', '%=', '^=', '|=', '&=', '~=',
    '+', '-', '*', '/', '%', '^', '<', '>', '!', '&', '|', '~', '?', ':',
    '(', ')', '[', ']', ',', ';', '='];
  var CONSTS = { pi: Math.PI, phi: (1 + Math.sqrt(5)) / 2, e: Math.E };

  function EelError(msg, line) { this.message = (line ? 'line ' + line + ': ' : '') + msg; this.line = line; }
  EelError.prototype = Object.create(Error.prototype);
  EelError.prototype.name = 'EelError';

  // REAPER's strings are bytes: one character per UTF-8 byte, as the C runtime
  // keeps them.
  function bytes(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0x800) out += String.fromCharCode(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out += String.fromCharCode(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out += String.fromCharCode(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }

  function lex(src, firstLine) {
    var toks = [], i = 0, n = src.length, line = firstLine || 1;
    while (i < n) {
      var c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { var j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (c === '/' && src[i + 1] === '*') {
        var k = src.indexOf('*/', i + 2); if (k < 0) k = n;
        for (var q = i; q < k; q++) if (src[q] === '\n') line++;
        i = k + 2; continue;
      }
      if (c === '"') {
        var buf = '', p = i + 1;
        while (p < n && src[p] !== '"') {
          if (src[p] === '\\' && p + 1 < n) {
            var e = src[p + 1];
            buf += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e; p += 2;
          } else { if (src[p] === '\n') line++; buf += src[p++]; }
        }
        toks.push({ k: 'str', v: bytes(buf), line: line }); i = p + 1; continue;
      }
      if (c === "'") {
        var close = src.indexOf("'", i + 1);
        var val = 0;
        var lit = bytes(src.slice(i + 1, close));
        for (var x = 0; x < lit.length; x++) val = val * 256 + lit.charCodeAt(x);
        toks.push({ k: 'num', v: val, line: line }); i = close + 1; continue;
      }
      if (c === '#') {
        var nm = /^#[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i, i + 200));
        if (nm) { toks.push({ k: 'nstr', v: nm[0].toLowerCase(), line: line }); i += nm[0].length; }
        else { toks.push({ k: 'tmpstr', line: line }); i++; }
        continue;
      }
      if (c === '$') {
        var rest = src.slice(i, i + 64), m;
        if ((m = /^\$x([0-9A-Fa-f]+)/.exec(rest))) { toks.push({ k: 'num', v: parseInt(m[1], 16), line: line }); i += m[0].length; continue; }
        if ((m = /^\$'(.)'/.exec(rest))) { toks.push({ k: 'num', v: m[1].charCodeAt(0), line: line }); i += m[0].length; continue; }
        if ((m = /^\$~(\d+)/.exec(rest))) { toks.push({ k: 'num', v: Math.pow(2, Number(m[1])) - 1, line: line }); i += m[0].length; continue; }
        if ((m = /^\$(pi|phi|e)\b/i.exec(rest))) { toks.push({ k: 'num', v: CONSTS[m[1].toLowerCase()], line: line }); i += m[0].length; continue; }
        throw new EelError('bad $ constant', line);
      }
      var hx = /^0[xX][0-9A-Fa-f]+/.exec(src.slice(i, i + 40));
      if (hx) { toks.push({ k: 'num', v: parseInt(hx[0], 16), line: line }); i += hx[0].length; continue; }
      var num = /^(\d+\.\d*|\.\d+|\d+)/.exec(src.slice(i, i + 64));
      if (num) { toks.push({ k: 'num', v: Number(num[0]), line: line }); i += num[0].length; continue; }
      var id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i, i + 200));
      if (id) {
        var w = id[0].toLowerCase();
        toks.push({ k: (w === 'function' || w === 'local' || w === 'instance' || w === 'globals' || w === 'global' || w === 'static') ? 'kw' : 'id', v: w, line: line });
        i += id[0].length; continue;
      }
      var op = null;
      for (var o = 0; o < OPS.length; o++) if (src.substr(i, OPS[o].length) === OPS[o]) { op = OPS[o]; break; }
      if (!op) throw new EelError("unexpected '" + c + "'", line);
      toks.push({ k: 'op', v: op, line: line }); i += op.length;
    }
    toks.push({ k: 'eof', line: line });
    return toks;
  }

  // ------------------------------------------------------------ parser ----
  var ASSIGN = { '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1, '^=': 1, '|=': 1, '&=': 1, '~=': 1, '<<=': 1, '>>=': 1 };
  var CMP = { '==': 1, '===': 1, '!=': 1, '!==': 1, '<': 1, '>': 1, '<=': 1, '>=': 1 };

  function parse(toks, funcs) {
    var p = 0;
    function peek() { return toks[p]; }
    function at(k, v) { var t = toks[p]; return t.k === k && (v === undefined || t.v === v); }
    function eat(k, v) { if (at(k, v)) return toks[p++]; return null; }
    function expect(k, v) {
      var t = eat(k, v);
      if (!t) { var q = toks[p]; throw new EelError('expected ' + (v || k) + ', got ' + (q.v !== undefined ? q.v : q.k), q.line); }
      return t;
    }

    function program() {
      var items = [];
      for (;;) {
        while (eat('op', ';')) {}
        if (at('eof')) break;
        if (at('kw', 'function')) { func(); continue; }
        items.push(assign());
        if (!at('op', ';') && !at('eof') && !at('kw', 'function')) {
          var t = peek();
          throw new EelError("missing ';' before " + (t.v !== undefined ? t.v : t.k), t.line);
        }
      }
      return { k: 'seq', items: items };
    }
    function func() {
      var line = expect('kw', 'function').line;
      var name = expect('id').v;
      expect('op', '(');
      var params = [];
      while (!at('op', ')')) { params.push(expect('id').v.replace(/\*$/, '')); eat('op', ','); }
      expect('op', ')');
      var locals = [], instance = [], globals = null;
      while (at('kw')) {
        var kw = toks[p++].v;
        expect('op', '(');
        var list = [];
        while (!at('op', ')')) {
          if (at('op', '*')) { p++; list.push('*'); }
          else list.push(expect('id').v.replace(/\*$/, ''));
          eat('op', ',');
        }
        expect('op', ')');
        if (kw === 'local' || kw === 'static') locals = locals.concat(list);
        else if (kw === 'instance') instance = instance.concat(list);
        else globals = (globals || []).concat(list);
      }
      expect('op', '(');
      var body = block();
      expect('op', ')');
      while (eat('op', ';')) {}
      funcs[name] = { name: name, params: params, locals: locals, instance: instance, globals: globals, body: body, line: line };
    }
    function block() {
      var items = [];
      for (;;) {
        while (eat('op', ';')) {}
        if (at('op', ')') || at('eof')) break;
        if (at('kw', 'function')) { func(); continue; }
        items.push(assign());
        if (!at('op', ';')) break;
      }
      while (eat('op', ';')) {}
      return items.length === 1 ? items[0] : { k: 'seq', items: items };
    }
    function arg() {
      var items = [assign()];
      while (at('op', ';')) {
        p++;
        if (at('op', ')') || at('op', ',')) break;
        items.push(assign());
      }
      return items.length === 1 ? items[0] : { k: 'seq', items: items };
    }
    function assign() {
      var lhs = ternary();
      var t = peek();
      if (t.k === 'op' && ASSIGN[t.v]) {
        p++;
        return { k: 'assign', op: t.v, lhs: lhs, rhs: assign(), line: t.line };
      }
      return lhs;
    }
    function ternary() {
      var c = logic();
      if (eat('op', '?')) {
        var a = at('op', ':') ? { k: 'num', v: 0 } : assign();
        var b = null;
        if (eat('op', ':')) b = assign();
        return { k: 'if', c: c, a: a, b: b };
      }
      return c;
    }
    function logic() {
      var n = cmp();
      while (at('op', '&&') || at('op', '||')) n = { k: 'logic', op: toks[p++].v, a: n, b: cmp() };
      return n;
    }
    function cmp() {
      var n = bit();
      while (peek().k === 'op' && CMP[peek().v]) n = { k: 'bin', op: toks[p++].v, a: n, b: bit() };
      return n;
    }
    function bit() {
      var n = add();
      while (at('op', '|') || at('op', '&') || at('op', '~')) n = { k: 'bin', op: toks[p++].v, a: n, b: add() };
      return n;
    }
    function add() {
      var n = mul();
      while (at('op', '+') || at('op', '-')) n = { k: 'bin', op: toks[p++].v, a: n, b: mul() };
      return n;
    }
    function mul() {
      var n = shift();
      while (at('op', '*') || at('op', '/')) n = { k: 'bin', op: toks[p++].v, a: n, b: shift() };
      return n;
    }
    function shift() {
      var n = mod();
      while (at('op', '<<') || at('op', '>>')) n = { k: 'bin', op: toks[p++].v, a: n, b: mod() };
      return n;
    }
    function mod() {
      var n = pow();
      while (at('op', '%')) { p++; n = { k: 'bin', op: '%', a: n, b: pow() }; }
      return n;
    }
    function pow() {
      var n = unary();
      if (at('op', '^')) { p++; return { k: 'bin', op: '^', a: n, b: pow() }; }
      return n;
    }
    function unary() {
      var t = peek();
      if (t.k === 'op' && (t.v === '!' || t.v === '-' || t.v === '+')) { p++; return { k: 'un', op: t.v, a: unary() }; }
      return postfix();
    }
    function postfix() {
      var n = primary();
      while (at('op', '[')) {
        p++;
        var idx = at('op', ']') ? { k: 'num', v: 0 } : assign();
        expect('op', ']');
        n = { k: 'index', base: n, idx: idx };
      }
      return n;
    }
    function primary() {
      var t = toks[p++];
      switch (t.k) {
        case 'num': return { k: 'num', v: t.v };
        case 'str': return { k: 'strlit', v: t.v };
        case 'nstr': return { k: 'nstr', v: t.v };
        case 'tmpstr': return { k: 'tmpstr', id: p };
        case 'op':
          if (t.v === '(') { var b = block(); expect('op', ')'); return b; }
          break;
        case 'id':
          if (at('op', '(')) {
            p++;
            var args = [];
            while (!at('op', ')')) { args.push(arg()); if (!eat('op', ',')) break; }
            expect('op', ')');
            if ((t.v === 'while' || t.v === 'loop') && at('op', '(')) {
              p++; var body = block(); expect('op', ')');
              args.push(body);
            }
            return { k: 'call', name: t.v, args: args, line: t.line };
          }
          return { k: 'var', name: t.v, line: t.line };
      }
      throw new EelError('unexpected ' + (t.v !== undefined ? t.v : t.k), t.line);
    }
    return program();
  }

  // ---------------------------------------------------------- compiler ----
  // Builtins that are plain maths: name -> JS expression template.
  var MATH = {
    sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', asin: 'Math.asin', acos: 'Math.acos',
    atan: 'Math.atan', atan2: 'Math.atan2', sqrt: 'H.sqrt', exp: 'Math.exp', log: 'Math.log',
    log10: 'Math.log10', abs: 'Math.abs', floor: 'Math.floor', ceil: 'Math.ceil',
    min: 'Math.min', max: 'Math.max', pow: 'Math.pow', sign: 'H.sign', invsqrt: 'H.invsqrt',
    sqr: 'H.sqr', rand: 'H.rand', exp2: 'H.exp2'
  };

  function Compiler(slotsOf) {
    this.slots = slotsOf;          // name -> index into v
    this.funcs = {};
    this.compiledFuncs = {};
    this.funcCode = [];
    this.strConsts = [];
    this.temps = 0;
    this.gfx = false;              // compile gfx_* calls for a host to draw
  }
  Compiler.prototype.slot = function (name) {
    var s = this.slots[name];
    if (s === undefined) { s = this.slots.__count++; this.slots[name] = s; }
    return s;
  };

  Compiler.prototype.compileSection = function (code, firstLine) {
    var ast = parse(lex(code, firstLine), this.funcs);
    var saveTemps = this.temps;
    this.temps = 0;
    var body = this.stmts(ast, null, true, 'r');
    var temps = this.tempDecl();
    this.temps = saveTemps;
    return 'var r = 0;' + temps + body + 'return r;';
  };
  Compiler.prototype.tempDecl = function () {
    if (!this.temps) return '';
    var names = [];
    for (var i = 1; i <= this.temps; i++) names.push('t' + i);
    return 'var ' + names.join(', ') + ';';
  };
  Compiler.prototype.temp = function () { this.temps++; return 't' + this.temps; };

  // Names inside a function: parameters, statics, instance variables, or
  // globals. A function called as ns.f() keeps its instance() variables, and
  // anything it names as this.x, in ns: ns.x (REAPER's pseudo-objects).
  Compiler.prototype.ref = function (name, ctx) {
    if (ctx) {
      var pi = ctx.fn.params.indexOf(name);
      if (pi >= 0) return 'p' + pi;
      if (ctx.fn.locals.indexOf(name) >= 0) return 'v[' + this.slot(ctx.fn.name + '::' + name) + ']';
      if (ctx.fn.instance.indexOf(name) >= 0) return 'v[' + this.slot(ctx.ns ? ctx.ns + '.' + name : name) + ']';
    }
    if (name.indexOf('this.') === 0) return 'v[' + this.slot(resolveThis(name, ctx)) + ']';
    return 'v[' + this.slot(name) + ']';
  };
  // this.x, this.child.x: the namespace the function was called in.
  function resolveThis(name, ctx) {
    var ns = ctx && ctx.ns ? ctx.ns : '';
    if (name === 'this') return ns;
    return ns ? ns + '.' + name.slice(5) : name.slice(5);
  }

  function hasControl(n) {
    if (!n || typeof n !== 'object') return false;
    if (n.k === 'call' && (n.name === 'loop' || n.name === 'while')) return true;
    for (var key in n) {
      var c = n[key];
      if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) if (hasControl(c[i])) return true; }
      else if (c && typeof c === 'object' && c.k && hasControl(c)) return true;
    }
    return false;
  }

  // Statements computing `n`; the value lands in `target` when wanted.
  Compiler.prototype.stmts = function (n, ctx, want, target) {
    if (n.k === 'seq') {
      var out = '';
      if (!n.items.length) return want ? target + ' = 0;' : '';
      for (var i = 0; i < n.items.length; i++) {
        var last = i === n.items.length - 1;
        out += this.stmts(n.items[i], ctx, want && last, target);
      }
      return out;
    }
    if (n.k === 'call' && n.name === 'loop') {
      var cnt = this.temp(), ii = this.temp();
      var s = cnt + ' = Math.min(' + MAXLOOP + ', Math.trunc(' + this.expr(n.args[0], ctx) + ')); ';
      if (want) s += target + ' = 0; ';
      s += 'for (' + ii + ' = 0; ' + ii + ' < ' + cnt + '; ' + ii + '++) {' + (n.args[1] ? this.stmts(n.args[1], ctx, want, target) : '') + '}';
      return s;
    }
    if (n.k === 'call' && n.name === 'while') {
      var guard = this.temp(), r = this.temp();
      if (n.args.length >= 2) {
        return guard + ' = 0; ' + (want ? target + ' = 0; ' : '') + 'while (Math.abs(' + this.expr(n.args[0], ctx) + ') >= ' + EPS + ' && ' + guard + '++ < ' + MAXLOOP + ') {' +
          this.stmts(n.args[1], ctx, want, target) + '}';
      }
      return guard + ' = 0; do {' + this.stmts(n.args[0], ctx, true, r) + (want ? target + ' = ' + r + ';' : '') +
        '} while (Math.abs(' + r + ') >= ' + EPS + ' && ++' + guard + ' < ' + MAXLOOP + ');';
    }
    if (n.k === 'if' && hasControl(n)) {
      var o = 'if (Math.abs(' + this.expr(n.c, ctx) + ') >= ' + EPS + ') {' + this.stmts(n.a, ctx, want, target) + '}';
      if (n.b) o += ' else {' + this.stmts(n.b, ctx, want, target) + '}';
      else if (want) o += ' else { ' + target + ' = 0; }';
      return o;
    }
    var e = this.expr(n, ctx);
    return (want ? target + ' = ' + e : e) + ';';
  };

  function T(e) { return '(Math.abs(' + e + ') >= ' + EPS + ')'; }

  Compiler.prototype.expr = function (n, ctx) {
    var self = this;
    // A loop inside an expression: the statements holding it run in a
    // closure. Only a loop, a sequence or a conditional is one; anything else
    // compiles its parts, each of which takes its own closure if it needs one.
    if (hasControl(n) && (n.k === 'seq' || n.k === 'if' || (n.k === 'call' && (n.name === 'loop' || n.name === 'while')))) {
      return '(() => { var rr = 0; ' + this.stmts(n, ctx, true, 'rr') + ' return rr; })()';
    }
    switch (n.k) {
      case 'raw': return n.code;
      case 'num': return n.v < 0 ? '(' + String(n.v) + ')' : String(n.v);
      case 'strlit': return String(this.strConst(n.v));
      case 'nstr': return 'S.named(' + JSON.stringify(n.v) + ')';
      case 'tmpstr': return 'S.tempStr(' + n.id + ')';
      case 'var': return this.varRead(n.name, ctx);
      case 'seq': {
        if (!n.items.length) return '0';
        return '(' + n.items.map(function (x) { return self.expr(x, ctx); }).join(', ') + ')';
      }
      case 'if':
        return '(' + T(this.expr(n.c, ctx)) + ' ? ' + this.expr(n.a, ctx) + ' : ' + (n.b ? this.expr(n.b, ctx) : '0') + ')';
      case 'logic': {
        var a = T(this.expr(n.a, ctx)), b = T(this.expr(n.b, ctx));
        return '((' + a + (n.op === '&&' ? ' && ' : ' || ') + b + ') ? 1 : 0)';
      }
      case 'un':
        if (n.op === '!') return '(' + T(this.expr(n.a, ctx)) + ' ? 0 : 1)';
        if (n.op === '-') return '(-' + this.expr(n.a, ctx) + ')';
        return this.expr(n.a, ctx);
      case 'bin': return this.binary(n.op, this.expr(n.a, ctx), this.expr(n.b, ctx));
      case 'index': return this.memRead(n, ctx);
      case 'assign': return this.assignment(n, ctx);
      case 'call': return this.call(n, ctx);
    }
    throw new EelError('cannot compile ' + n.k);
  };

  Compiler.prototype.binary = function (op, a, b) {
    switch (op) {
      case '+': return '(' + a + ' + ' + b + ')';
      case '-': return '(' + a + ' - ' + b + ')';
      case '*': return '(' + a + ' * ' + b + ')';
      case '/': return '(' + a + ' / ' + b + ')';
      case '%': return 'H.mod(' + a + ', ' + b + ')';
      case '^': return 'Math.pow(' + a + ', ' + b + ')';
      case '<<': return 'H.shl(' + a + ', ' + b + ')';
      case '>>': return 'H.shr(' + a + ', ' + b + ')';
      case '|': return 'H.bor(' + a + ', ' + b + ')';
      case '&': return 'H.band(' + a + ', ' + b + ')';
      case '~': return 'H.bxor(' + a + ', ' + b + ')';
      case '==': return '(Math.abs(' + a + ' - ' + b + ') < ' + EPS + ' ? 1 : 0)';
      case '!=': return '(Math.abs(' + a + ' - ' + b + ') < ' + EPS + ' ? 0 : 1)';
      case '===': return '(' + a + ' === ' + b + ' ? 1 : 0)';
      case '!==': return '(' + a + ' !== ' + b + ' ? 1 : 0)';
      case '<': case '>': case '<=': case '>=': return '(' + a + ' ' + op + ' ' + b + ' ? 1 : 0)';
    }
    throw new EelError('bad operator ' + op);
  };

  Compiler.prototype.strConst = function (s) {
    var i = this.strConsts.indexOf(s);
    if (i < 0) { i = this.strConsts.length; this.strConsts.push(s); }
    return 10000 + i;
  };

  Compiler.prototype.varRead = function (name, ctx) {
    if (name === 'gmem') return 'S.gmemBase';
    return this.ref(name, ctx);
  };

  Compiler.prototype.address = function (n, ctx) {
    if (n.base.k === 'var' && n.base.name === 'gmem') return { gmem: true, addr: this.expr(n.idx, ctx) };
    var base = this.expr(n.base, ctx);
    var idx = n.idx.k === 'num' && n.idx.v === 0 ? null : this.expr(n.idx, ctx);
    return { gmem: false, addr: idx === null ? base : '(' + base + ' + ' + idx + ')' };
  };
  Compiler.prototype.memRead = function (n, ctx) {
    var a = this.address(n, ctx);
    if (a.gmem) return 'S.grd(' + a.addr + ')';
    // Inline: a typed array read out of range is undefined, which || makes 0.
    return '(M[(' + a.addr + ' + ' + EPS + ') | 0] || 0)';
  };

  var COMPOUND = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '^=': '^', '|=': '|', '&=': '&', '~=': '~', '<<=': '<<', '>>=': '>>' };

  Compiler.prototype.assignment = function (n, ctx) {
    var self = this;
    var lhs = n.lhs, rhs = this.expr(n.rhs, ctx);
    function value(cur) { return n.op === '=' ? rhs : self.binary(COMPOUND[n.op], cur, rhs); }
    if (lhs.k === 'var') {
      var r = this.ref(lhs.name, ctx);
      return '(' + r + ' = ' + value(r) + ')';
    }
    if (lhs.k === 'index') {
      var a = this.address(lhs, ctx), t = this.temp();
      var rdf = a.gmem ? 'S.grd' : 'rd', wrf = a.gmem ? 'S.gwr' : 'wr';
      return '(' + t + ' = ' + a.addr + ', ' + wrf + '(' + t + ', ' + value(rdf + '(' + t + ')') + '))';
    }
    if (lhs.k === 'if') {
      var tv = this.temp();
      var asg = function (side) { return side ? self.assignment({ k: 'assign', op: '=', lhs: side, rhs: { k: 'raw', code: tv } }, ctx) : '0'; };
      if (n.op !== '=') throw new EelError('compound assignment to a conditional is not supported');
      return '(' + tv + ' = ' + rhs + ', ' + T(this.expr(lhs.c, ctx)) + ' ? ' + asg(lhs.a) + ' : ' + asg(lhs.b) + ')';
    }
    if (lhs.k === 'nstr' || lhs.k === 'strlit') {
      return 'S.strcpy(' + this.expr(lhs, ctx) + ', ' + rhs + ')';
    }
    if (lhs.k === 'call' && lhs.name === 'slider') {
      var si = this.temp();
      return '(' + si + ' = ' + this.expr(lhs.args[0], ctx) + ', S.setSliderByIndex(' + si + ', ' + value('S.sliderByIndex(' + si + ')') + '))';
    }
    if (lhs.k === 'seq' && lhs.items.length) {
      var head = lhs.items.slice(0, -1).map(function (x) { return self.expr(x, ctx); });
      return '(' + head.concat([this.assignment({ k: 'assign', op: n.op, lhs: lhs.items[lhs.items.length - 1], rhs: n.rhs }, ctx)]).join(', ') + ')';
    }
    throw new EelError('cannot assign to ' + lhs.k);
  };

  // A variable passed by reference (midirecv, file_var): its JS lvalue.
  Compiler.prototype.lvalue = function (n, ctx) {
    if (n.k === 'var') return this.ref(n.name, ctx);
    return null;
  };

  Compiler.prototype.call = function (n, ctx) {
    var self = this, name = n.name, args = n.args;
    function A(i) { return args[i] === undefined ? '0' : self.expr(args[i], ctx); }
    function all() { return args.map(function (x) { return self.expr(x, ctx); }).join(', '); }
    if (MATH[name]) return MATH[name] + '(' + all() + ')';
    switch (name) {
      case 'midirecv': {
        var lv = args.map(function (x) { return self.lvalue(x, ctx); });
        var sets = [];
        for (var i = 0; i < lv.length; i++) {
          if (!lv[i]) continue;
          var src = lv.length >= 4 ? 'S.mr[' + i + ']' : (i === 2 ? '(S.mr[2] + S.mr[3] * 256)' : 'S.mr[' + i + ']');
          sets.push(lv[i] + ' = ' + src);
        }
        return '(S.midirecv() ? (' + (sets.length ? sets.join(', ') + ', ' : '') + 'S.mr[1]) : 0)';
      }
      case 'midisend':
        if (args.length >= 4) return 'S.midisend(' + A(0) + ', ' + A(1) + ', ' + A(2) + ', ' + A(3) + ')';
        return 'S.midisend3(' + A(0) + ', ' + A(1) + ', ' + A(2) + ')';
      case 'midisend_buf': return 'S.midisendBuf(' + A(0) + ', ' + A(1) + ', ' + A(2) + ')';
      case 'midisyx': return 'S.midisendBuf(' + A(0) + ', ' + A(1) + ', ' + A(2) + ')';
      case 'file_var': {
        var fv = this.lvalue(args[1], ctx);
        if (!fv) return 'S.fileVar(' + A(0) + ', ' + A(1) + ')';
        return '(' + fv + ' = S.fileVar(' + A(0) + ', ' + fv + '))';
      }
      case 'file_riff': {
        // channels and sample rate come back through the arguments
        var nc = this.lvalue(args[1], ctx), fr = this.lvalue(args[2], ctx);
        var t0 = this.temp();
        return '(' + t0 + ' = S.fileRiff(' + A(0) + ')' + (nc ? ', ' + nc + ' = S.riff[0]' : '') + (fr ? ', ' + fr + ' = S.riff[1]' : '') + ', ' + t0 + ')';
      }
      case 'slider': return 'S.sliderByIndex(' + A(0) + ')';
      case 'loop': case 'while':
        return '(() => { var rr = 0; ' + this.stmts(n, ctx, true, 'rr') + ' return rr; })()';
      case 'match': case 'matchi': {
        var refs = args.slice(2).map(function (x) { return self.lvalue(x, ctx); });
        var call = 'S.match(' + (name === 'matchi' ? 'true' : 'false') + ', ' + A(0) + ', ' + A(1) + ')';
        if (!refs.length) return call;
        var tm = this.temp();
        var assigns = refs.map(function (r, k) { return r ? r + ' = S.matchOut[' + k + ']' : ''; }).filter(Boolean);
        return '(' + tm + ' = ' + call + ', ' + tm + ' ? (' + (assigns.length ? assigns.join(', ') + ', ' : '') + '1) : 0)';
      }
    }
    if (this.funcs[name]) return this.userCall(this.funcs[name], args, ctx, '');
    if (name.indexOf('.') > 0) {
      var base = name.slice(name.lastIndexOf('.') + 1), prefix = name.slice(0, name.lastIndexOf('.'));
      if (this.funcs[base]) return this.userCall(this.funcs[base], args, ctx, prefix === 'this' || prefix.indexOf('this.') === 0 ? resolveThis(prefix, ctx) : prefix);
    }
    if (/^gfx_|^mouse_/.test(name)) {
      if (!this.gfx) return '(' + (args.length ? all() + ', ' : '') + '0)';
      // Width and height come back through the arguments, as file_riff's do.
      if (name === 'gfx_measurestr' || name === 'gfx_measurechar' || name === 'gfx_getimgdim') {
        var mw = this.lvalue(args[1] || { k: 'num', v: 0 }, ctx), mh = this.lvalue(args[2] || { k: 'num', v: 0 }, ctx);
        var tg = this.temp();
        return '(' + tg + ' = S.call(' + JSON.stringify(name) + ', ' + A(0) + ')' + (mw ? ', ' + mw + ' = S.gm[0]' : '') +
               (mh ? ', ' + mh + ' = S.gm[1]' : '') + ', ' + tg + ')';
      }
    }
    return 'S.call(' + JSON.stringify(name) + (args.length ? ', ' + all() : '') + ')';
  };

  // One compiled copy per function and namespace, as EEL2 does: a.f() and
  // b.f() are two functions, each with its own instance variables.
  Compiler.prototype.userCall = function (fn, args, ctx, ns) {
    var self = this;
    ns = ns || '';
    if (args.length !== fn.params.length && !(args.length === 1 && fn.params.length === 0)) {
      // EEL2 refuses the wrong number of arguments at compile time.
      throw new EelError(fn.name + '() takes ' + fn.params.length + ' arguments, given ' + args.length);
    }
    var jsName = 'F_' + fn.name.replace(/\./g, '_') + (ns ? '$' + ns.replace(/\./g, '$') : '');
    var key = fn.name + '@' + ns;
    if (!this.compiledFuncs[key]) {
      this.compiledFuncs[key] = true;
      var saved = this.temps;
      this.temps = 0;
      var body = this.stmts(fn.body, { fn: fn, ns: ns }, true, 'r');
      var temps = this.tempDecl();
      this.temps = saved;
      var params = fn.params.map(function (_, i) { return 'p' + i; });
      this.funcCode.push('function ' + jsName + '(' + params.join(', ') + ') { var r = 0;' + temps + body + ' return r; }');
    }
    return jsName + '(' + args.slice(0, fn.params.length).map(function (x) { return self.expr(x, ctx); }).join(', ') + ')';
  };

  // ----------------------------------------------------------- helpers ----
  function i64(x) { return Math.trunc(x); }
  function bigOp(a, b, f) { return Number(BigInt.asIntN(64, f(BigInt(i64(a)), BigInt(i64(b))))); }
  var H = {
    sqrt: function (x) { return Math.sqrt(Math.abs(x)); },
    sign: function (x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); },
    invsqrt: function (x) { return 1 / Math.sqrt(x); },
    sqr: function (x) { return x * x; },
    exp2: function (x) { return Math.pow(2, x); },
    rand: function (x) { return Math.random() * (x === undefined ? 1 : x); },
    mod: function (a, b) {
      var ib = Math.trunc(Math.abs(b));
      return ib ? Math.trunc(Math.abs(a)) % ib : 0;
    },
    shl: function (a, b) { return bigOp(a, b, function (x, y) { return x << (y & 63n); }); },
    shr: function (a, b) { return bigOp(a, b, function (x, y) { return x >> (y & 63n); }); },
    bor: function (a, b) {
      if (Math.abs(a) < 2147483648 && Math.abs(b) < 2147483648) return (i64(a) | i64(b));
      return bigOp(a, b, function (x, y) { return x | y; });
    },
    band: function (a, b) {
      if (Math.abs(a) < 2147483648 && Math.abs(b) < 2147483648) return (i64(a) & i64(b));
      return bigOp(a, b, function (x, y) { return x & y; });
    },
    bxor: function (a, b) {
      if (Math.abs(a) < 2147483648 && Math.abs(b) < 2147483648) return (i64(a) ^ i64(b));
      return bigOp(a, b, function (x, y) { return x ^ y; });
    }
  };

  // C's %f: the double's exact decimal value, rounded half to even.
  var F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
  function toFixedC(x, f) {
    if (!isFinite(x)) return String(x);
    var neg = x < 0; F64[0] = Math.abs(x);
    var hi = U32[1], lo = U32[0], exp = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (exp === 0) exp = 1; else mant |= 1n << 52n;
    var e = exp - 1075, D, sc;
    if (e >= 0) { D = mant << BigInt(e); sc = 0; } else { D = mant * (5n ** BigInt(-e)); sc = -e; }
    var q;
    if (f >= sc) q = D * (10n ** BigInt(f - sc));
    else {
      var div = 10n ** BigInt(sc - f); q = D / div; var r2 = (D % div) * 2n;
      if (r2 > div || (r2 === div && (q & 1n) === 1n)) q += 1n;
    }
    var s = q.toString();
    if (f > 0) { while (s.length <= f) s = '0' + s; s = s.slice(0, s.length - f) + '.' + s.slice(s.length - f); }
    return (neg && /[1-9]/.test(s) ? '-' : (neg ? '-' : '')) + s;
  }

  // EEL2's sprintf, on doubles.
  function eelFormat(fmt, values) {
    var vi = 0;
    return fmt.replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?([dixXfgecs%])/g, function (all, flags, width, prec, conv) {
      if (conv === '%') return '%';
      var v = values[vi++], s;
      if (v === undefined) v = 0;
      switch (conv) {
        case 'd': case 'i': s = String(Math.trunc(v.num !== undefined ? v.num : v)); break;
        case 'x': s = (Math.trunc(v) >>> 0).toString(16); break;
        case 'X': s = (Math.trunc(v) >>> 0).toString(16).toUpperCase(); break;
        case 'f': s = toFixedC(Number(v), prec === undefined ? 6 : Number(prec)); break;
        case 'e': s = Number(v).toExponential(prec === undefined ? 6 : Number(prec)); break;
        case 'g': s = String(Number(Number(v).toPrecision(prec === undefined ? 6 : Math.max(1, Number(prec))))); break;
        case 'c': s = String.fromCharCode(Math.trunc(v)); break;
        case 's': s = v.str !== undefined ? v.str : String(v); break;
      }
      if (flags.indexOf('+') >= 0 && conv !== 's' && Number(v) >= 0) s = '+' + s;
      var w = Number(width || 0);
      while (s.length < w) s = flags.indexOf('-') >= 0 ? s + ' ' : (flags.indexOf('0') >= 0 && conv !== 's' ? '0' + s : ' ' + s);
      return s;
    });
  }

  // ---------------------------------------------------------- instance ----
  function JSFX(text, opts) {
    opts = opts || {};
    this.file = parseFile(text, opts.readImport);
    this.srate = opts.sampleRate || 48000;
    this.slots = { __count: 0 };
    var self = this;
    var C = new Compiler(this.slots);
    C.gfx = !!opts.gfx;
    // Predeclare what the host reads and writes.
    ['srate', 'samplesblock', 'tempo', 'play_state', 'play_position', 'beat_position', 'ts_num', 'ts_denom',
     'num_ch', 'trigger', 'pdc_delay', 'pdc_bot_ch', 'pdc_top_ch', 'pdc_midi', 'ext_noinit', 'ext_nodenorm',
     'ext_midi_bus', 'midi_bus', 'gfx_ext_retina'].forEach(function (n) { C.slot(n); });
    for (var c = 0; c < 64; c++) C.slot('spl' + c);
    for (var s = 1; s <= 64; s++) C.slot('slider' + s);
    this.file.sliders.forEach(function (sl) { C.slot(sl.variable); });
    if (C.gfx) ['gfx_r', 'gfx_g', 'gfx_b', 'gfx_a', 'gfx_a2', 'gfx_x', 'gfx_y', 'gfx_w', 'gfx_h', 'gfx_texth', 'gfx_mode', 'gfx_clear',
                'gfx_dest', 'gfx_ext_flags', 'mouse_x', 'mouse_y', 'mouse_cap', 'mouse_wheel', 'mouse_hwheel'].forEach(function (n) { C.slot(n); });

    var sections = {};
    ['init', 'slider', 'block', 'sample', 'serialize'].concat(C.gfx ? ['gfx'] : []).forEach(function (name) {
      var parts = self.file.sections[name];
      if (!parts.length) return;
      sections[name] = parts.map(function (part) { return C.compileSection(part.code, part.line); });
    });
    // @gfx is parsed for its functions only, so @init code that calls a
    // helper defined there still compiles.
    if (!C.gfx) this.file.sections.gfx.forEach(function (part) {
      try { parse(lex(part.code, part.line), C.funcs); } catch (e) { /* the window is not run */ }
    });

    // Room for names a later eval() adds: the generated code holds on to v.
    this.v = new Float64Array(this.slots.__count + 4096);
    this.strConsts = C.strConsts;
    var src = [];
    src.push('"use strict";');
    // Memory is one Float64Array that doubles when written past its end, up
    // to EEL2's 8M words; rd and wr sit beside it so V8 can inline them.
    src.push('var v = S.v, M = new Float64Array(' + BLOCK + ');');
    src.push('function rd(a) { var i = (a + ' + EPS + ') | 0; return (i >= 0 && i < M.length) ? M[i] : 0; }');
    src.push('function wr(a, x) { var i = (a + ' + EPS + ') | 0; if (i >= 0 && i < M.length) { M[i] = x; return x; } return grow(i, x); }');
    src.push('function grow(i, x) { if (i < 0 || i >= ' + (BLOCK * NBLOCKS) + ') return x; var n = M.length; while (n <= i) n *= 2;' +
             ' var N = new Float64Array(Math.min(n, ' + (BLOCK * NBLOCKS) + ')); N.set(M); M = N; M[i] = x; return x; }');
    src.push('S.rd = rd; S.wr = wr; S.clearMem = function () { M = new Float64Array(' + BLOCK + '); };');
    // Code compiled later (eval) runs in this scope, beside M, v and the helpers.
    src.push('S.evalIn = function (code) { return eval(code); };');
    src.push(C.funcCode.join('\n'));
    Object.keys(sections).forEach(function (name) {
      src.push('S.sec_' + name + ' = [' + sections[name].map(function (b) { return 'function () {' + b + '}'; }).join(',\n') + '];');
    });
    this.code = src.join('\n');
    this.reset();
    new Function('S', 'H', this.code)(this, H);
  }

  JSFX.prototype.reset = function () {
    this.v.fill(0);
    this.mem = new Array(NBLOCKS);
    this.gmem = NS.sharedGmem || (NS.sharedGmem = {});
    this.gmemName = (/gmem=(\S+)/.exec(this.file.options) || [])[1] || '';
    this.strings = {};
    this.namedIds = {};
    this.nextNamed = 90000;
    this.midiIn = []; this.midiInPos = 0; this.midiOut = [];
    this.mr = [0, 0, 0, 0];
    this.matchOut = [];
    this.serial = null;
    this.blockCount = 0;
    this.sliderDirty = true;
    this.sampleFrame = 0;
    var self = this;
    if (this.clearMem) this.clearMem();
    this.file.sliders.forEach(function (sl) { self.v[self.slots[sl.variable]] = sl.def; });
  };

  JSFX.prototype.slot = function (name) { return this.slots[name.toLowerCase()]; };
  JSFX.prototype.getVar = function (name) { var s = this.slot(name); return s === undefined ? 0 : this.v[s]; };
  JSFX.prototype.setVar = function (name, val) { var s = this.slot(name); if (s !== undefined) this.v[s] = val; };

  JSFX.prototype.sliderVar = function (n) {
    for (var i = 0; i < this.file.sliders.length; i++) if (this.file.sliders[i].index === n) return this.file.sliders[i].variable;
    return 'slider' + n;
  };
  JSFX.prototype.sliderByIndex = function (n) { return this.v[this.slots[this.sliderVar(Math.trunc(n))]] || 0; };
  JSFX.prototype.setSliderByIndex = function (n, val) { this.v[this.slots[this.sliderVar(Math.trunc(n))]] = val; return val; };
  JSFX.prototype.getSlider = function (n) { return this.sliderByIndex(n); };
  JSFX.prototype.setSlider = function (n, val) {
    this.setSliderByIndex(n, val);
    this.sliderDirty = true;
  };

  JSFX.prototype.runSection = function (name) {
    var list = this['sec_' + name];
    if (!list) return 0;
    var r = 0;
    for (var i = 0; i < list.length; i++) r = list[i]();
    return r;
  };

  JSFX.prototype.setTime = function (t) {
    var v = this.v, s = this.slots;
    if (t.tempo !== undefined) v[s.tempo] = t.tempo;
    if (t.playState !== undefined) v[s.play_state] = t.playState;
    if (t.beat !== undefined) v[s.beat_position] = t.beat;
    if (t.seconds !== undefined) v[s.play_position] = t.seconds;
    if (t.num !== undefined) v[s.ts_num] = t.num;
    if (t.den !== undefined) v[s.ts_denom] = t.den;
  };

  JSFX.prototype.init = function (sampleRate) {
    if (sampleRate) this.srate = sampleRate;
    var keep = this.file.sliders.map(function (sl) { return this.v[this.slots[sl.variable]]; }, this);
    this.reset();
    this.file.sliders.forEach(function (sl, i) { this.v[this.slots[sl.variable]] = keep[i]; }, this);
    var v = this.v, s = this.slots;
    v[s.srate] = this.srate;
    v[s.num_ch] = Math.max(this.file.inPins.length, this.file.outPins.length);
    v[s.tempo] = v[s.tempo] || 120; v[s.ts_num] = v[s.ts_num] || 4; v[s.ts_denom] = v[s.ts_denom] || 4;
    this.runSection('init');
    this.runSection('slider');
    this.sliderDirty = false;
    this.initialised = true;
  };

  /* One block: `inputs`/`outputs` are arrays of Float32Array per channel (or
   * null for a MIDI-only device), `midi` is [{offset, data:[b1,b2,b3]}]
   * sorted by offset. Returns the MIDI sent, with offsets. */
  JSFX.prototype.process = function (n, inputs, outputs, midi) {
    if (!this.initialised) this.init();
    var v = this.v, s = this.slots;
    if (this.sliderDirty) { this.sliderDirty = false; this.runSection('slider'); }
    v[s.samplesblock] = n;
    this.midiIn = midi || [];
    this.midiInPos = 0;
    this.midiOut = [];
    this.runSection('block');
    var sec = this.sec_sample;
    if (sec && sec.length) {
      var nIn = inputs ? inputs.length : 0, nOut = outputs ? outputs.length : 0;
      var nch = Math.max(nIn, nOut, 2);
      var spl = [];
      for (var c = 0; c < nch; c++) spl.push(s['spl' + c]);
      for (var i = 0; i < n; i++) {
        this.sampleFrame = i;
        for (var ci = 0; ci < nch; ci++) v[spl[ci]] = ci < nIn && inputs[ci] ? inputs[ci][i] : 0;
        for (var k = 0; k < sec.length; k++) sec[k]();
        for (var co = 0; co < nOut; co++) if (outputs[co]) outputs[co][i] = v[spl[co]];
      }
    } else if (outputs && inputs) {
      for (var ch = 0; ch < outputs.length; ch++) if (outputs[ch] && inputs[ch]) outputs[ch].set(inputs[ch]);
    }
    // MIDI a plug-in did not read passes through, as in REAPER.
    for (var r = this.midiInPos; r < this.midiIn.length; r++) this.midiOut.push(this.midiIn[r]);
    this.blockCount++;
    var out = this.midiOut;
    out.sort(function (a, b) { return a.offset - b.offset; });
    return out;
  };

  // ------------------------------------------------------- the host API --
  JSFX.prototype.midirecv = function () {
    if (this.midiInPos >= this.midiIn.length) return 0;
    var ev = this.midiIn[this.midiInPos++];
    this.mr[0] = ev.offset; this.mr[1] = ev.data[0]; this.mr[2] = ev.data[1] || 0; this.mr[3] = ev.data[2] || 0;
    return 1;
  };
  JSFX.prototype.midisend = function (offset, b1, b2, b3) {
    this.midiOut.push({ offset: Math.max(0, Math.trunc(offset)), data: [Math.trunc(b1) & 255, Math.trunc(b2) & 127, Math.trunc(b3) & 127] });
    return b1;
  };
  JSFX.prototype.midisend3 = function (offset, b1, b23) {
    b23 = Math.trunc(b23);
    return this.midisend(offset, b1, b23 & 255, (b23 >> 8) & 255);
  };
  JSFX.prototype.midisendBuf = function (offset, buf, len) {
    var data = [];
    for (var i = 0; i < len; i++) data.push(Math.trunc(this.rd(buf + i)) & 255);
    this.midiOut.push({ offset: Math.max(0, Math.trunc(offset)), data: data });
    return len;
  };

  JSFX.prototype.grd = function (a) { var g = this.gmem[this.gmemName]; if (!g) return 0; var i = (a + EPS) | 0; return g[i] || 0; };
  JSFX.prototype.gwr = function (a, val) {
    var g = this.gmem[this.gmemName] || (this.gmem[this.gmemName] = {});
    g[(a + EPS) | 0] = val; return val;
  };

  // Strings: literals are 10000+, named strings 90000+, slots 0-1023 free.
  JSFX.prototype.str = function (id) {
    id = Math.trunc(id);
    if (id >= 10000 && id < 90000) return this.strConsts[id - 10000] || '';
    return this.strings[id] || '';
  };
  JSFX.prototype.setStr = function (id, s) { this.strings[Math.trunc(id)] = s; return id; };
  JSFX.prototype.named = function (name) {
    var id = this.namedIds[name];
    if (id === undefined) { id = this.namedIds[name] = this.nextNamed++; this.strings[id] = ''; }
    return id;
  };
  JSFX.prototype.tempStr = function (site) { var id = 200000 + site; if (this.strings[id] === undefined) this.strings[id] = ''; return id; };
  JSFX.prototype.strcpy = function (d, s) { return this.setStr(d, this.str(s)); };
  JSFX.prototype.match = function (ci, pat, sid) {
    var p = this.str(pat), s = this.str(sid);
    var re = '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(re, ci ? 'i' : '').test(s) ? 1 : 0;
  };

  JSFX.prototype.riff = [0, 0];
  JSFX.prototype.fileRiff = function (h) {
    var f = this.files && this.files[Math.trunc(h)];
    this.riff = f ? [f.channels, f.rate] : [0, 0];
    return f ? 1 : 0;
  };
  // One frame of @gfx, drawn by `host`: an object with a method per gfx_*
  // function (each called with the JSFX first), as the Ableton devices give.
  // `w`, `h` and `mouse` ({x, y, cap, wheel, hwheel}) are what REAPER sets.
  JSFX.prototype.runGfx = function (host, w, h, mouse) {
    if (!this.sec_gfx) return 0;
    if (!this.initialised) this.init();
    var v = this.v, s = this.slots;
    this.gfxHost = host;
    v[s.gfx_w] = w; v[s.gfx_h] = h;
    if (mouse) {
      v[s.mouse_x] = mouse.x; v[s.mouse_y] = mouse.y; v[s.mouse_cap] = mouse.cap;
      if (mouse.wheel) v[s.mouse_wheel] += mouse.wheel;
      if (mouse.hwheel) v[s.mouse_hwheel] += mouse.hwheel;
    }
    return this.runSection('gfx');
  };
  JSFX.prototype.gm = [0, 0];

  JSFX.prototype.call = function (name) {
    var a = Array.prototype.slice.call(arguments, 1);
    if (this.gfxHost && this.gfxHost[name]) return +this.gfxHost[name].apply(this.gfxHost, [this].concat(a)) || 0;
    var f = BUILTINS[name];
    if (!f) {
      if (!this.warned) this.warned = {};
      if (!this.warned[name] && typeof console !== 'undefined') { this.warned[name] = true; console.warn('JSFX: no ' + name + '()'); }
      return 0;
    }
    return f.apply(this, a);
  };

  // @serialize: values written in order, read back in order.
  JSFX.prototype.fileVar = function (h, cur) {
    h = Math.trunc(h);
    if (h === 0 && this.serial) {
      if (this.serial.mode === 'write') { this.serial.data.push(cur); return cur; }
      var d = this.serial.data[this.serial.pos++];
      return d === undefined ? cur : (typeof d === 'number' ? d : cur);
    }
    var f = this.files && this.files[h];
    if (f && f.pos < f.values.length) return f.values[f.pos++];
    return cur;
  };
  JSFX.prototype.serialize = function () {
    this.serial = { mode: 'write', data: [], pos: 0 };
    this.runSection('serialize');
    var data = this.serial.data;
    this.serial = null;
    return { sliders: this.file.sliders.map(function (sl) { return this.v[this.slots[sl.variable]]; }, this), data: data };
  };
  JSFX.prototype.deserialize = function (state) {
    if (!state) return;
    if (!this.initialised) this.init();
    if (state.sliders) this.file.sliders.forEach(function (sl, i) {
      if (state.sliders[i] !== undefined) this.v[this.slots[sl.variable]] = state.sliders[i];
    }, this);
    this.serial = { mode: 'read', data: state.data || [], pos: 0 };
    this.runSection('serialize');
    this.serial = null;
    this.sliderDirty = true;
  };

  // Run a line of EEL2 against this instance: how a device's own buttons
  // (Panic, Transfer to Pads...) are pressed from Middaw's controls.
  JSFX.prototype.eval = function (code) {
    var C = new Compiler(this.slots);
    C.gfx = !!opts.gfx;
    C.strConsts = this.strConsts;
    // reuse the instance's functions by recompiling them into this snippet
    var funcs = {};
    var self = this;
    ['init', 'slider', 'block', 'sample', 'serialize', 'gfx'].forEach(function (name) {
      self.file.sections[name].forEach(function (part) { try { parse(lex(part.code, part.line), funcs); } catch (e) {} });
    });
    C.funcs = funcs;
    var body = C.compileSection(code, 1);
    var fn = this.evalIn('(function () {' + C.funcCode.join('\n') + ' return function () {' + body + '}; })()');
    if (this.slots.__count > this.v.length) throw new EelError('too many new variables in eval');
    return fn();
  };

  var BUILTINS = {
    memset: function (d, val, n) { for (var i = 0; i < n; i++) this.wr(d + i, val); return d; },
    memcpy: function (d, s, n) {
      var tmp = [];
      for (var i = 0; i < n; i++) tmp.push(this.rd(s + i));
      for (var j = 0; j < n; j++) this.wr(d + j, tmp[j]);
      return d;
    },
    freembuf: function (n) { return n; },
    mem_set_values: function () { return 0; },
    time: function () { return Math.floor(Date.now() / 1000); },
    time_precise: function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; },
    sliderchange: function () { if (this.onSliderChange) this.onSliderChange(); return 0; },
    slider_automate: function () { if (this.onSliderChange) this.onSliderChange(); return 0; },
    slider_show: function () { return 0; },
    strlen: function (s) { return this.str(s).length; },
    strcpy: function (d, s) { return this.setStr(d, this.str(s)); },
    strcat: function (d, s) { return this.setStr(d, this.str(d) + this.str(s)); },
    strcmp: function (a, b) { var x = this.str(a), y = this.str(b); return x < y ? -1 : x > y ? 1 : 0; },
    stricmp: function (a, b) { var x = this.str(a).toLowerCase(), y = this.str(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; },
    strncpy: function (d, s, n) { return this.setStr(d, this.str(s).slice(0, n)); },
    strcpy_substr: function (d, s, off, len) {
      var str = this.str(s);
      if (off < 0) off = Math.max(0, str.length + off);
      return this.setStr(d, len === undefined ? str.slice(off) : str.substr(off, Math.max(0, len)));
    },
    str_getchar: function (s, i) { var str = this.str(s); if (i < 0) i += str.length; return i >= 0 && i < str.length ? str.charCodeAt(i) : 0; },
    str_setchar: function (s, i, c) {
      var str = this.str(s); if (i < 0) i += str.length;
      if (i >= 0 && i <= str.length) this.setStr(s, str.slice(0, i) + String.fromCharCode(c) + str.slice(i + 1));
      return c;
    },
    sprintf: function (d, fmt) {
      var self = this, vals = Array.prototype.slice.call(arguments, 2);
      var f = this.str(fmt);
      // %s takes a string handle
      var vi = 0;
      var mapped = [];
      f.replace(/%[-+ 0#]*\d*(?:\.\d+)?([dixXfgecs%])/g, function (all, conv) {
        if (conv === '%') return all;
        var x = vals[vi++];
        mapped.push(conv === 's' ? { str: self.str(x) } : x);
        return all;
      });
      return this.setStr(d, eelFormat(f, mapped));
    },
    file_open: function (s) {
      var name = this.str(s);
      var vals = this.openFile ? this.openFile(name) : null;
      if (!vals) return -1;
      if (!this.files) { this.files = {}; this.nextFile = 1; }
      var h = this.nextFile++;
      this.files[h] = { values: vals.samples || vals, pos: 0, channels: vals.channels || 1, rate: vals.rate || this.srate };
      return h;
    },
    file_close: function (h) { if (this.files) delete this.files[h]; return 0; },
    file_rewind: function (h) { if (this.files && this.files[h]) this.files[h].pos = 0; return 0; },
    file_avail: function (h) {
      h = Math.trunc(h);
      if (h === 0 && this.serial) return this.serial.mode === 'write' ? -1 : this.serial.data.length - this.serial.pos;
      var f = this.files && this.files[h];
      return f ? f.values.length - f.pos : 0;
    },
    file_riff: function () { return 0; },
    file_text: function () { return 0; },
    file_mem: function (h, addr, n) {
      h = Math.trunc(h);
      if (h === 0 && this.serial) {
        if (this.serial.mode === 'write') { for (var i = 0; i < n; i++) this.serial.data.push(this.rd(addr + i)); }
        else { for (var j = 0; j < n; j++) { var d = this.serial.data[this.serial.pos++]; this.wr(addr + j, typeof d === 'number' ? d : 0); } }
        return n;
      }
      var f = this.files && this.files[h];
      if (!f) return 0;
      var k = 0;
      for (; k < n && f.pos < f.values.length; k++) this.wr(addr + k, f.values[f.pos++]);
      return k;
    },
    file_string: function (h, s) {
      h = Math.trunc(h);
      if (h === 0 && this.serial) {
        if (this.serial.mode === 'write') this.serial.data.push({ s: this.str(s) });
        else { var d = this.serial.data[this.serial.pos++]; if (d && d.s !== undefined) this.setStr(s, d.s); }
      }
      return 1;
    },
    export_buffer_to_project: function () { return this.exportBuffer ? this.exportBuffer.apply(this, arguments) : 0; },
    get_host_placement: function () { return 0; },
    get_host_numchan: function () { return 2; },
    set_host_numchan: function () { return 0; },
    get_pin_mapping: function () { return 0; },
    set_pdc: function () { return 0; },
    printf: function () { return 0; },
    gfx_getchar: function () { return 0; }
  };

  NS.JSFX = JSFX;
  NS.parseFile = parseFile;
  NS.parseSliderLine = parseSliderLine;
  NS.lexEel = lex;
  NS.parseEel = parse;
  NS.EelError = EelError;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawJSFX = globalThis.MiddawJSFX || {}))
  : (globalThis.MiddawJSFX = globalThis.MiddawJSFX || {}));


/* ---- kit/gfx.js ---- */
/* REAPER's gfx_* drawing, on Max's mgraphics: the host a JSFX's @gfx runs on
 * (MiddawJSFX's runGfx). Each method takes the JSFX first, reads gfx_r, gfx_x
 * and the rest from its variables, and draws as REAPER would: text from its
 * top-left, gfx_x moved on past it, angles from twelve o'clock clockwise.
 *
 * gfx_showmenu cannot wait for a choice inside a frame, so it asks for one:
 * `menu` is set, the frame returns 0, and the device draws the menu. When an
 * item is chosen the device puts the variables back as they were at the start
 * of that frame and runs it again, and this time gfx_showmenu returns the item.
 */
var Gfx = (function () {
  'use strict';
  function Host(g) {
    this.g = g;
    this.fonts = { 0: { name: 'Arial', size: 13, flags: 0 } };
    this.font = 0;
    this.menu = null;        // { text, x, y } asked for this frame
    this.choice = 0;         // the item to give gfx_showmenu on the replayed frame
    this.slots = null;
  }
  Host.prototype.begin = function (g, fx) {
    this.g = g;
    if (!this.slots || this.fx !== fx) {
      this.fx = fx;
      var s = fx.slots;
      this.slots = { r: s.gfx_r, g: s.gfx_g, b: s.gfx_b, a: s.gfx_a, x: s.gfx_x, y: s.gfx_y, texth: s.gfx_texth,
                     mx: s.mouse_x, my: s.mouse_y, clear: s.gfx_clear };
    }
    this.menu = null;
    this.applyFont();
  };
  Host.prototype.v = function (k) { return this.fx.v[this.slots[k]]; };
  Host.prototype.set = function (k, x) { this.fx.v[this.slots[k]] = x; };
  Host.prototype.colour = function () {
    this.g.set_source_rgba(clamp(this.v('r')), clamp(this.v('g')), clamp(this.v('b')), clamp(this.v('a')));
  };
  // EEL2 strings are bytes; REAPER draws them as UTF-8.
  function utf8(s) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : (x || 0); }
  function num(x, d) { return x === undefined || x !== x ? d : x; }

  // ------------------------------------------------------------ colour ---
  Host.prototype.gfx_set = function (fx, r, g, b, a) {
    r = num(r, 0);
    this.set('r', r); this.set('g', num(g, r)); this.set('b', num(b, r)); this.set('a', num(a, 1));
    return 0;
  };

  // ------------------------------------------------------------ shapes ---
  Host.prototype.gfx_rect = function (fx, x, y, w, h, filled) {
    if (!(w > 0 && h > 0)) return 0;
    this.colour();
    if (num(filled, 1)) { this.g.rectangle(x, y, w, h); this.g.fill(); }
    else { this.g.set_line_width(1); this.g.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); this.g.stroke(); }
    return 0;
  };
  Host.prototype.gfx_line = function (fx, x1, y1, x2, y2) {
    this.colour();
    this.g.set_line_width(1);
    this.g.move_to(x1 + 0.5, y1 + 0.5); this.g.line_to(x2 + 0.5, y2 + 0.5); this.g.stroke();
    return 0;
  };
  Host.prototype.gfx_lineto = function (fx, x, y) {
    this.gfx_line(fx, this.v('x'), this.v('y'), x, y);
    this.set('x', x); this.set('y', y);
    return 0;
  };
  Host.prototype.gfx_circle = function (fx, x, y, r, fill) {
    this.colour();
    this.g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (num(fill, 0)) this.g.fill(); else { this.g.set_line_width(1); this.g.stroke(); }
    return 0;
  };
  Host.prototype.gfx_arc = function (fx, x, y, r, a1, a2) {
    this.colour();
    this.g.set_line_width(1);
    this.g.arc(x, y, Math.max(0, r), a1 - Math.PI / 2, a2 - Math.PI / 2);
    this.g.stroke();
    return 0;
  };
  Host.prototype.gfx_roundrect = function (fx, x, y, w, h, radius) {
    this.colour();
    this.g.set_line_width(1);
    this.g.rectangle_rounded(x + 0.5, y + 0.5, w, h, radius * 2, radius * 2);
    this.g.stroke();
    return 0;
  };
  Host.prototype.gfx_triangle = function (fx) {
    var p = Array.prototype.slice.call(arguments, 1);
    if (p.length < 6) return 0;
    this.colour();
    this.g.move_to(p[0], p[1]);
    for (var i = 2; i + 1 < p.length; i += 2) this.g.line_to(p[i], p[i + 1]);
    this.g.close_path();
    this.g.fill();
    return 0;
  };
  Host.prototype.gfx_gradrect = function (fx, x, y, w, h, r, g, b, a) {
    this.g.set_source_rgba(clamp(r), clamp(g), clamp(b), clamp(num(a, 1)));
    this.g.rectangle(x, y, w, h); this.g.fill();
    return 0;
  };

  // -------------------------------------------------------------- text ---
  // gfx_setfont(idx, name, size, flags): flags is a character code, 'b' bold, 'i' italic.
  Host.prototype.gfx_setfont = function (fx, idx, name, size, flags) {
    idx = Math.trunc(num(idx, 0));
    if (name !== undefined && idx > 0) {
      this.fonts[idx] = { name: fx.str(name) || 'Arial', size: num(size, 13), flags: Math.trunc(num(flags, 0)) };
    }
    this.font = this.fonts[idx] ? idx : 0;
    this.applyFont();
    return 1;
  };
  Host.prototype.gfx_getfont = function () { return this.font; };
  Host.prototype.applyFont = function () {
    var f = this.fonts[this.font] || this.fonts[0], fl = f.flags;
    var bold = fl === 98 || ((fl >> 8) & 255) === 98 || ((fl >> 16) & 255) === 98;
    var italic = fl === 105 || ((fl >> 8) & 255) === 105 || ((fl >> 16) & 255) === 105;
    this.g.select_font_face(f.name, italic ? 'italic' : 'normal', bold ? 'bold' : 'normal');
    this.g.set_font_size(f.size);
    this.size = f.size;
    if (this.slots) this.set('texth', Math.round(f.size));
  };
  Host.prototype.measure = function (s) {
    var m = this.g.text_measure(s);
    return [m[0], Math.max(m[1], this.size)];
  };
  Host.prototype.gfx_measurestr = function (fx, s) { this.fx.gm = this.measure(utf8(fx.str(s))); return this.fx.gm[0]; };
  Host.prototype.gfx_measurechar = function (fx, c) { this.fx.gm = this.measure(String.fromCharCode(c)); return this.fx.gm[0]; };
  Host.prototype.text = function (s, flags, right, bottom) {
    var x = this.v('x'), y = this.v('y'), m = this.measure(s);
    flags = Math.trunc(num(flags, 0));
    if (right !== undefined && !(flags & 256)) {
      if (flags & 1) x = x + (right - x - m[0]) / 2; else if (flags & 2) x = right - m[0];
      if (flags & 4) y = y + (bottom - y - m[1]) / 2; else if (flags & 8) y = bottom - m[1];
    }
    this.colour();
    this.g.move_to(x, y + this.size * 0.8);
    this.g.show_text(s);
    this.set('x', x + m[0]);
    return 0;
  };
  Host.prototype.gfx_drawstr = function (fx, s, flags, right, bottom) { return this.text(utf8(fx.str(s)), flags, right, bottom); };
  Host.prototype.gfx_drawchar = function (fx, c) { return this.text(String.fromCharCode(c)); };
  Host.prototype.gfx_drawnumber = function (fx, n, digits) { return this.text(Number(n).toFixed(Math.max(0, Math.trunc(num(digits, 0))))); };
  Host.prototype.gfx_printf = function (fx, fmt) {
    var args = Array.prototype.slice.call(arguments, 2);
    var s = fx.str(fmt).replace(/%(-?\d*)(?:\.(\d+))?([dfsxXc%])/g, function (m, w, p, k) {
      if (k === '%') return '%';
      var a = args.shift();
      if (k === 's') return fx.str(a);
      if (k === 'c') return String.fromCharCode(a);
      if (k === 'x' || k === 'X') { var h = Math.trunc(a).toString(16); return k === 'X' ? h.toUpperCase() : h; }
      return k === 'd' ? String(Math.trunc(a)) : Number(a).toFixed(p === undefined ? 6 : +p);
    });
    return this.text(utf8(s));
  };

  // ------------------------------------------------------------- input ---
  // gfx_getchar(65536) asks about the window: 1 it has focus, 2 it is shown,
  // 4 the mouse is in it. With no argument it is the next key typed, which the
  // window's [key] hands in (Host.key); with a key it asks whether it is held.
  Host.prototype.gfx_getchar = function (fx, c) {
    if (c === 65536) return 1 | 2 | (this.mouseIn ? 4 : 0);
    if (c) return 0;
    return this.keys && this.keys.length ? this.keys.shift() : 0;
  };
  // Max's key codes as REAPER's gfx_getchar gives them: the arrows and the
  // editing keys are four-letter codes there.
  var KEYS = { 28: 0x6C656674, 29: 0x72676874, 30: 0x7570, 31: 0x646F776E, 127: 0x64656C, 8: 8, 9: 9, 13: 13, 27: 27,
               '-9': 0x6C656674, '-10': 0x72676874, '-11': 0x7570, '-12': 0x646F776E };
  Host.prototype.key = function (code) {
    (this.keys = this.keys || []).push(KEYS[code] !== undefined ? KEYS[code] : code);
    if (this.keys.length > 32) this.keys.shift();
  };
  Host.prototype.gfx_showmenu = function (fx, s) {
    if (this.choice) { var k = this.choice; this.choice = 0; return k; }
    this.menu = { text: utf8(fx.str(s)), x: this.v('x'), y: this.v('y') };
    return 0;
  };
  Host.prototype.gfx_setcursor = function () { return 0; };
  Host.prototype.gfx_getdropfile = function () { return 0; };
  Host.prototype.gfx_update = function () { return 0; };

  // A menu as gfx_showmenu writes it: items split by |, '#' greyed, '!'
  // ticked, '>' opens a submenu, '<' closes one. Numbered as REAPER numbers
  // them: every item that is not a submenu's title, in order, from 1.
  function parseMenu(text) {
    var out = [], depth = 0, n = 0;
    String(text).split('|').forEach(function (raw) {
      var t = raw, grey = false, tick = false, opens = false, closes = false;
      for (;;) {
        var c = t.charAt(0);
        if (c === '#') { grey = true; t = t.slice(1); } else if (c === '!') { tick = true; t = t.slice(1); }
        else if (c === '>') { opens = true; t = t.slice(1); } else if (c === '<') { closes = true; t = t.slice(1); } else break;
      }
      if (opens) { out.push({ label: t, title: true, depth: depth }); depth++; return; }
      if (t === '' && !closes) { out.push({ rule: true, depth: depth }); return; }
      n++;
      out.push({ label: t, index: n, grey: grey, tick: tick, depth: depth });
      if (closes) depth = Math.max(0, depth - 1);
    });
    return out;
  }

  return { Host: Host, parseMenu: parseMenu };
})();


/* ---- kit/live.js ---- */
/* The Live set, as the family's devices need it: the song's tempo, meter and
 * scale, the notes of the clip being edited, somewhere to put new notes, and
 * a way to hear notes before they are used.
 *
 * Everything goes through the Live Object Model (LiveAPI). Times are beats,
 * which in Live are quarter notes - the unit every family engine already
 * speaks - so nothing is converted but the field names.
 */
var Live = (function () {
  'use strict';
  function api(path) { return new LiveAPI(null, path); }
  function one(a, prop) { var v = a.get(prop); return Array.isArray(v) ? v[0] : v; }
  function exists(a) { return a && Number(a.id) !== 0; }
  function json(v) {
    if (typeof v === 'string') return JSON.parse(v);
    if (Array.isArray(v) && typeof v[0] === 'string' && v.length === 1) return JSON.parse(v[0]);
    return v;
  }

  // Live 12's scale names, as ScaleView numbers its scales (1-16). A scale
  // ScaleView has no name for is left out: the device keeps its own key.
  var SCALE = {
    'Major': 1, 'Minor': 2, 'Harmonic Minor': 3, 'Dorian': 5, 'Phrygian': 6, 'Lydian': 7,
    'Mixolydian': 8, 'Major Pentatonic': 10, 'Minor Pentatonic': 11, 'Minor Blues': 13,
    'Whole Tone': 14, 'Whole-half Dim.': 15, 'Half-whole Dim.': 16
  };
  // ScaleView's eighteen roots, and the spelling a key on each pitch class
  // takes: flats for the major side, sharps where a minor key has them.
  var ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'];
  var MAJOR_SIDE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  var MINOR_SIDE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  var MINORISH = { 2: 1, 3: 1, 5: 1, 6: 1, 11: 1, 13: 1 };
  var SCALE_NAMES = ['Major', 'Minor (Natural)', 'Harmonic Minor', 'Ionian', 'Dorian', 'Phrygian', 'Lydian',
                     'Mixolydian', 'Aeolian', 'Major Pentatonic', 'Minor Pentatonic', 'Major Blues', 'Minor Blues',
                     'Whole Tone', 'Diminished Whole-Half', 'Diminished Half-Whole'];

  function song() {
    var s = api('live_set');
    var out = { tempo: +one(s, 'tempo') || 120, num: +one(s, 'signature_numerator') || 4,
                den: +one(s, 'signature_denominator') || 4, playing: !!+one(s, 'is_playing'),
                position: +one(s, 'current_song_time') || 0, key: null };
    var mode = s.get('scale_mode');
    if (mode !== undefined && mode !== null) {
      var name = String(one(s, 'scale_name')), pc = +one(s, 'root_note');
      var sc = SCALE[name];
      out.liveScale = { on: !!+(Array.isArray(mode) ? mode[0] : mode), name: name, root: pc };
      if (sc) out.key = { root: ROOTS.indexOf((MINORISH[sc] ? MINOR_SIDE : MAJOR_SIDE)[((pc % 12) + 12) % 12]) + 1, scale: sc };
    }
    return out;
  }

  function detailClip() {
    var c = api('live_set view detail_clip');
    if (!exists(c) || !+one(c, 'is_midi_clip')) return null;
    return c;
  }

  // The clip being edited: its selected notes if any are selected, else every
  // note in its loop. Starts are from the start of what was taken.
  function clipNotes() {
    var c = detailClip();
    if (!c) return null;
    var from = +one(c, 'loop_start') || 0, to = +one(c, 'loop_end') || 0;
    var raw = null, selected = false;
    try { raw = json(c.call('get_selected_notes_extended')); selected = raw && raw.notes && raw.notes.length > 0; } catch (e) { raw = null; }
    if (!selected) raw = json(c.call('get_notes_extended', 0, 128, from, Math.max(0, to - from)));
    var notes = ((raw && raw.notes) || []).filter(function (n) { return !n.mute; }).map(function (n) {
      return { start: n.start_time, len: n.duration, pitch: n.pitch, vel: Math.round(n.velocity) };
    });
    var first = selected && notes.length ? Math.min.apply(null, notes.map(function (n) { return n.start; })) : from;
    var beats = to - from;
    if (selected) {
      var bar = 4, end = 0;
      notes.forEach(function (n) { end = Math.max(end, n.start + n.len); });
      first = Math.floor(first / bar) * bar;
      beats = Math.ceil((end - first) / bar) * bar;
    }
    notes.forEach(function (n) { n.start -= first; });
    notes.sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
    return { notes: notes, beats: beats, name: String(one(c, 'name') || ''), selected: selected, drums: drumTrack() };
  }

  // A track whose instrument is a Drum Rack plays drums: its note numbers name
  // drums, not pitches, and the engines treat them that way.
  function drumTrack() {
    try {
      var track = api('this_device canonical_parent'), n = track.getcount('devices');
      for (var i = 0; i < n; i++) if (+one(api(track.unquotedpath + ' devices ' + i), 'can_have_drum_pads')) return true;
    } catch (e) { /* not known: not drums */ }
    return false;
  }

  function liveNotes(notes) {
    return { notes: notes.map(function (n) {
      return { pitch: Math.max(0, Math.min(127, Math.round(n.pitch))), start_time: Math.max(0, n.start),
               duration: Math.max(1 / 128, n.len), velocity: Math.max(1, Math.min(127, Math.round(n.vel || 100))), mute: 0 };
    }) };
  }

  function undoable(fn) {
    var s = api('live_set');
    try { s.call('begin_undo_step'); } catch (e) { /* Live before 11.1 */ }
    try { return fn(); } finally { try { s.call('end_undo_step'); } catch (e2) { /* as above */ } }
  }

  function show(clip) {
    try { api('live_set view').set('detail_clip', 'id', Number(clip.id)); } catch (e) { /* the clip is made either way */ }
  }

  function selectedScene() {
    var scene = api('live_set view selected_scene'), n = api('live_set').getcount('scenes');
    for (var i = 0; i < n; i++) if (Number(api('live_set scenes ' + i).id) === Number(scene.id)) return i;
    return 0;
  }
  function thisTrack() {
    var track = api('this_device canonical_parent');
    if (!exists(track) || !+one(track, 'has_midi_input')) return null;
    return track;
  }
  // Where this device's track is in the set, for putting new tracks beside it.
  function trackIndex(track) {
    var n = api('live_set').getcount('tracks');
    for (var i = 0; i < n; i++) if (Number(api('live_set tracks ' + i).id) === Number(track.id)) return i;
    return n - 1;
  }
  function clipInSlot(slot, notes, beats, name) {
    slot.call('create_clip', Math.max(1, beats));
    var clip = api(slot.unquotedpath + ' clip');
    if (name) clip.set('name', name);
    clip.call('add_new_notes', liveNotes(notes));
    return clip;
  }
  function freeSlot(track, from) {
    var n = track.getcount('clip_slots');
    for (var k = 0; k < n; k++) {
      var at = (from + k) % n, slot = api(track.unquotedpath + ' clip_slots ' + at);
      if (!+one(slot, 'has_clip')) return { slot: slot, at: at };
    }
    return null;
  }
  function arrangementClipOn(track, notes, beats, name, at) {
    var before = track.getcount('arrangement_clips');
    try { track.call('create_midi_clip', at, Math.max(1, beats)); } catch (e) { /* checked below */ }
    var count = track.getcount('arrangement_clips');
    if (!(count > before)) return false;
    for (var i = 0; i < count; i++) {
      var clip = api(track.unquotedpath + ' arrangement_clips ' + i);
      if (Math.abs((+one(clip, 'start_time') || 0) - at) < 1e-6) {
        if (name) clip.set('name', name);
        clip.call('add_new_notes', liveNotes(notes));
        return true;
      }
    }
    return false;
  }

  // New notes, as a new clip in the first free slot on this device's track,
  // from the selected scene down. `more` are further parts ({name, notes}),
  // each on a new MIDI track after this one, in the same scene. Returns what
  // happened, for the status line.
  function newClip(notes, beats, name, more) {
    var track = thisTrack();
    if (!track) return { ok: false, message: 'This device needs to be on a MIDI track.' };
    var free = freeSlot(track, selectedScene());
    if (!free) return { ok: false, message: 'Every clip slot on this track is full. Add a scene, then try again.' };
    return undoable(function () {
      var clip = clipInSlot(free.slot, notes, beats, name);
      var made = newTracks(track, more, function (t) {
        clipInSlot(api(t.unquotedpath + ' clip_slots ' + free.at), this.notes, beats, this.name);
      });
      show(clip);
      return { ok: true, message: 'Added a clip in scene ' + (free.at + 1) + (made ? ', and ' + made + ' on new tracks beside it.' : '.') };
    });
  }

  // New notes on a new MIDI track beside this one, in the selected scene:
  // a suggestion goes with the music it was made for, not over it.
  function newTrackClip(notes, beats, name, more) {
    var track = thisTrack();
    if (!track) return { ok: false, message: 'This device needs to be on a MIDI track.' };
    var scene = selectedScene();
    return undoable(function () {
      var parts = [{ name: name, notes: notes }].concat(more || []);
      newTracks(track, parts, function (t) { show(clipInSlot(api(t.unquotedpath + ' clip_slots ' + scene), this.notes, beats, this.name)); });
      return { ok: true, message: parts.length === 1 ? 'Added a track beside this one, with the clip in scene ' + (scene + 1) + '.'
                                                     : 'Added ' + parts.length + ' tracks beside this one, with the clips in scene ' + (scene + 1) + '.' };
    });
  }

  // Each further part on a new MIDI track, in order, after this one.
  function newTracks(track, more, put) {
    if (!more || !more.length) return '';
    var at = trackIndex(track), song = api('live_set');
    more.forEach(function (part, k) {
      song.call('create_midi_track', at + 1 + k);
      var t = api('live_set tracks ' + (at + 1 + k));
      t.set('name', part.name);
      put.call(part, t);
    });
    return more.length === 1 ? 'one more part' : more.length + ' more parts';
  }

  // New notes in place of the notes of the clip being edited, from its loop start.
  function replaceInClip(notes, beats) {
    var c = detailClip();
    if (!c) return { ok: false, message: 'No MIDI clip is open. Open one in Detail View, then try again.' };
    var from = +one(c, 'loop_start') || 0;
    return undoable(function () {
      var span = Math.max(beats, (+one(c, 'loop_end') || 0) - from);
      c.call('remove_notes_extended', 0, 128, from, span);
      c.call('add_new_notes', liveNotes(notes.map(function (n) {
        return { start: n.start + from, len: n.len, pitch: n.pitch, vel: n.vel };
      })));
      if ((+one(c, 'loop_end') || 0) < from + beats) c.set('loop_end', from + beats);
      return { ok: true, message: 'Replaced the notes in “' + (String(one(c, 'name') || '') || 'the clip') + '”.' };
    });
  }

  // New notes in the Arrangement at the insert marker, on this device's track
  // (Track.create_midi_clip, Live 12.2 and later); further parts as above.
  function arrangementClip(notes, beats, name, more) {
    var track = thisTrack();
    if (!track) return { ok: false, message: 'This device needs to be on a MIDI track.' };
    var at = +one(api('live_set'), 'current_song_time') || 0;
    return undoable(function () {
      if (!arrangementClipOn(track, notes, beats, name, at)) {
        return { ok: false, message: 'This version of Live can\u2019t add Arrangement clips from a device. Choose New Clip instead.' };
      }
      var made = newTracks(track, more, function (t) { arrangementClipOn(t, this.notes, beats, this.name, at); });
      return { ok: true, message: 'Added a clip to the Arrangement at beat ' + (Math.round(at * 100) / 100 + 1) +
               (made ? ', and ' + made + ' on new tracks beside it.' : '.') };
    });
  }

  // ------------------------------------------------------------ player ---
  // Notes heard through this device's MIDI out: the instrument after it on
  // the track plays them. A Task ticks every few milliseconds and sends what
  // is due; nothing waits on the transport.
  function Player(send) {
    this.send = send; this.events = []; this.pos = 0; this.t0 = 0; this.task = null; this.sounding = {};
    this.onEnd = null;
  }
  Player.prototype.play = function (notes, tempo, onEnd) {
    this.stop();
    var ms = 60000 / (tempo || 120), ev = [];
    notes.forEach(function (n) {
      ev.push({ t: n.start * ms, on: true, pitch: n.pitch, vel: n.vel || 100 });
      ev.push({ t: (n.start + n.len) * ms - 1, on: false, pitch: n.pitch });
    });
    ev.sort(function (a, b) { return a.t - b.t || (a.on === b.on ? 0 : a.on ? 1 : -1); });
    this.events = ev; this.pos = 0; this.t0 = Date.now(); this.onEnd = onEnd || null;
    var self = this;
    this.task = new Task(function () { self.tick(); }, this);
    this.task.interval = 4;
    this.task.repeat();
    this.tick();
  };
  Player.prototype.tick = function () {
    var now = Date.now() - this.t0;
    while (this.pos < this.events.length && this.events[this.pos].t <= now) {
      var e = this.events[this.pos++];
      if (e.on) { this.sounding[e.pitch] = (this.sounding[e.pitch] || 0) + 1; this.send([0x90, e.pitch, Math.max(1, Math.min(127, Math.round(e.vel)))]); }
      else if (this.sounding[e.pitch]) { this.sounding[e.pitch]--; this.send([0x80, e.pitch, 0]); }
    }
    if (this.pos >= this.events.length) {
      var end = this.onEnd;
      this.stop();
      if (end) end();
    }
  };
  Player.prototype.playing = function () { return !!this.task; };
  Player.prototype.stop = function () {
    if (this.task) { this.task.cancel(); this.task.freepeer && this.task.freepeer(); this.task = null; }
    var self = this;
    Object.keys(this.sounding).forEach(function (p) {
      for (var i = 0; i < self.sounding[p]; i++) self.send([0x80, +p, 0]);
    });
    this.sounding = {};
    this.onEnd = null;
  };

  return { song: song, clipNotes: clipNotes, newClip: newClip, newTrackClip: newTrackClip, replaceInClip: replaceInClip,
           arrangementClip: arrangementClip, drumTrack: drumTrack, Player: Player, ROOTS: ROOTS, SCALE_NAMES: SCALE_NAMES };
})();


/* ---- actions.js ---- */
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


/* ---- kit/jsfx_device.js ---- */
/* A family JSFX as a Max for Live MIDI effect: the .jsfx itself, unchanged,
 * on Middaw's EEL2 runtime, with its own @gfx window drawn in this [v8ui].
 *
 * The [v8ui] sits in the device's window subpatcher, which the device strip's
 * Show Window button opens. Its code runs whether the window is open or not.
 *
 * A Task ticks every few milliseconds: the MIDI that arrived since the last
 * tick goes in, a block as long as the time that passed is run, and what the
 * plug-in sends comes straight out. Live's tempo, meter, transport and song
 * position are what REAPER would give it.
 *
 * Expects, before it: Gfx, Live, MiddawJSFX, and DEVICE = { main, files,
 * actions? }. A device's own buttons (Load Clip, Insert the Take) are in
 * ACTIONS, defined in the repository's ableton/actions.js.
 * Inlet 0: bang (Live is ready), MIDI bytes, restore, and the strip's
 * commands. Outlets: 0 MIDI bytes, 1 the saved state to [pattr], 2 the
 * strip's status line.
 */
inlets = 1;
outlets = 3;
mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var SR = 48000;
var ACTIONS = typeof ACTIONS === 'undefined' ? {} : ACTIONS;

// The bundle keeps files as bytes; the runtime reads a .jsfx as text.
function source(name) {
  var t = DEVICE.files[name];
  if (t === undefined) return null;
  try { return decodeURIComponent(escape(t)); } catch (e) { return t; }
}
var fx = new MiddawJSFX.JSFX(source(DEVICE.main), { gfx: true, sampleRate: SR, readImport: source });
fx.init(SR);

var D = {
  ready: false, pending: null, task: null, last: 0, beat: 0, pos: 0,
  midiIn: [], running: [], status: '', host: new Gfx.Host(mgraphics),
  mouse: { x: -1, y: -1, cap: 0, wheel: 0 }, release: false, frameSaw: true,
  menu: null, menuSnap: null, menuMouse: null, frames: 0, song: { tempo: 120, num: 4, den: 4, playing: false }
};

function say(msg) { D.status = msg || ''; outlet(2, 'set', D.status); }
function send(data) { for (var i = 0; i < data.length; i++) outlet(0, data[i]); }

// ---------------------------------------------------------------- MIDI --
// [midiin] gives a byte at a time; a message is whole once its data are in.
function msg_int(b) {
  b = b & 255;
  if (b >= 0xF8) return;                      // real-time: not passed to the plug-in
  if (b & 0x80) { D.running = [b]; return; }
  if (!D.running.length) return;
  D.running.push(b);
  var st = D.running[0] & 0xF0, need = (st === 0xC0 || st === 0xD0) ? 2 : 3;
  if (D.running[0] >= 0xF0) { D.running = []; return; }  // system messages are not passed on
  if (D.running.length === need) {
    D.midiIn.push(need === 2 ? [D.running[0], D.running[1], 0] : D.running.slice());
    D.running = [D.running[0]];
  }
}

// --------------------------------------------------------------- clock --
function readSong() {
  try {
    var s = Live.song();
    D.song = { tempo: s.tempo, num: s.num, den: s.den, playing: s.playing, position: s.position };
  } catch (e) { /* outside Live */ }
}
function tick() {
  var now = Date.now();
  var ms = Math.min(100, Math.max(0, now - D.last));
  D.last = now;
  if ((D.frames++ & 63) === 0 || D.song.playing) readSong();
  var n = Math.max(1, Math.round(ms * SR / 1000));
  var spb = SR * 60 / D.song.tempo;
  fx.setTime({ tempo: D.song.tempo, num: D.song.num, den: D.song.den, playState: D.song.playing ? 1 : 0,
               beat: D.song.playing ? D.song.position : D.beat, seconds: (D.song.playing ? D.song.position : D.beat) * 60 / D.song.tempo });
  if (!D.song.playing) D.beat += n / spb;
  var midi = D.midiIn.map(function (data) { return { offset: 0, data: data }; });
  D.midiIn = [];
  var out = fx.process(n, null, null, midi);
  for (var i = 0; i < out.length; i++) send(out[i].data);
  if (ACTIONS.tick) ACTIONS.tick(fx);
  if ((D.frames & 511) === 0) save();
}
function start() {
  if (D.task) return;
  D.last = Date.now();
  D.task = new Task(tick, this);
  D.task.interval = 4;
  D.task.repeat();
  var draw = new Task(function () { mgraphics.redraw(); }, this);
  draw.interval = 33;
  draw.repeat();
  D.drawTask = draw;
}

// ------------------------------------------------------------ messages --
function bang() {
  D.ready = true;
  readSong();
  if (D.pending) { load(D.pending); D.pending = null; }
  start();
}
function restore(text) {
  var st = null;
  try { st = JSON.parse(String(text)); } catch (e) { return; }
  if (!D.ready) { D.pending = st; return; }
  load(st);
}
function load(st) {
  if (st && st.v === 1 && st.fx) { fx.deserialize(st.fx); lastSaved = JSON.stringify(st); }
}
// The plug-in's @serialize, kept with the Live set: written when it changes,
// so an untouched device does not mark the set as changed.
var lastSaved = '';
function save() {
  var s = JSON.stringify({ v: 1, fx: fx.serialize() });
  if (s === lastSaved) return;
  lastSaved = s;
  outlet(1, 'set', s);
}
// The strip's buttons: "action <name>".
function action(name) {
  var a = ACTIONS[name];
  if (!a) return;
  try { var msg = a(fx, Live); if (msg) say(msg); } catch (e) { say(String(e.message || e)); }
  save();
  mgraphics.redraw();
}
// Keys typed while the window has focus, from its [key].
function key(code) { D.host.key(code); mgraphics.redraw(); }
function anything() {
  var a = ACTIONS[messagename];
  if (a) action(messagename);
}

// --------------------------------------------------------------- paint --
function size() {
  var r = (typeof box !== 'undefined' && box.rect) ? box.rect : [0, 0].concat(fx.file.gfxSize || [800, 600]);
  return [r[2] - r[0], r[3] - r[1]];
}
function paint() {
  var g = mgraphics, sz = size(), h = D.host;
  var clear = fx.getVar('gfx_clear');
  var c = clear >= 0 ? clear : 0;           // REAPER keeps the last frame for -1; a [v8ui] cannot
  g.set_source_rgba((c & 255) / 255, ((c >> 8) & 255) / 255, ((c >> 16) & 255) / 255, 1);
  g.rectangle(0, 0, sz[0], sz[1]);
  g.fill();
  if (D.menu) { frame(g, sz, D.menuMouse); drawMenu(g, sz); return; }
  var snap = new Float64Array(fx.v);
  var mouse = { x: D.mouse.x, y: D.mouse.y, cap: D.mouse.cap, wheel: D.mouse.wheel };
  D.mouse.wheel = 0;
  frame(g, sz, mouse);
  D.frameSaw = true;
  if (D.release) { D.release = false; D.mouse.cap = 0; }
  if (h.menu) { D.menu = { items: Gfx.parseMenu(h.menu.text), x: mouse.x, y: mouse.y, hover: -1 }; D.menuSnap = snap; D.menuMouse = mouse; }
}
function frame(g, sz, mouse) {
  D.host.begin(g, fx);
  D.host.mouseIn = mouse.x >= 0 && mouse.y >= 0 && mouse.x < sz[0] && mouse.y < sz[1];
  try { fx.runGfx(D.host, sz[0], sz[1], mouse); } catch (e) { say('The window stopped: ' + (e.message || e)); }
}

// The menu gfx_showmenu asked for, over the window.
var ITEM_H = 20;
function menuRect(sz) {
  var m = D.menu, w = 40;
  mgraphics.select_font_face('Arial', 'normal', 'normal');
  mgraphics.set_font_size(12);
  m.items.forEach(function (it) { if (it.label) w = Math.max(w, mgraphics.text_measure(it.label)[0] + 40 + it.depth * 12); });
  var h = m.items.length * ITEM_H + 8;
  var x = Math.min(m.x, sz[0] - w - 2), y = Math.min(m.y, sz[1] - h - 2);
  return [Math.max(0, x), Math.max(0, y), w, h];
}
function drawMenu(g, sz) {
  var r = menuRect(sz), m = D.menu;
  g.set_source_rgba(0.165, 0.184, 0.216, 1); g.rectangle(r[0], r[1], r[2], r[3]); g.fill();
  g.set_source_rgba(0.227, 0.251, 0.29, 1); g.set_line_width(1); g.rectangle(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1); g.stroke();
  m.items.forEach(function (it, i) {
    var y = r[1] + 4 + i * ITEM_H;
    if (it.rule) { g.set_source_rgba(0.227, 0.251, 0.29, 1); g.rectangle(r[0] + 6, y + ITEM_H / 2, r[2] - 12, 1); g.fill(); return; }
    if (i === m.hover && it.index && !it.grey) { g.set_source_rgba(1, 0.949, 0, 1); g.rectangle(r[0] + 2, y, r[2] - 4, ITEM_H); g.fill(); }
    var on = i === m.hover && it.index && !it.grey;
    var ink = on ? [0.078, 0.09, 0.11] : it.grey || it.title ? [0.714, 0.737, 0.776] : [0.867, 0.882, 0.906];
    g.set_source_rgba(ink[0], ink[1], ink[2], 1);
    g.move_to(r[0] + 22 + it.depth * 12, y + 14);
    g.show_text(it.label);
    if (it.tick) { g.move_to(r[0] + 7 + it.depth * 12, y + 14); g.show_text('✓'); }
  });
}
function menuAt(x, y) {
  var r = menuRect(size());
  if (x < r[0] || x >= r[0] + r[2] || y < r[1] + 4 || y >= r[1] + r[3] - 4) return -1;
  return Math.floor((y - r[1] - 4) / ITEM_H);
}
function chooseMenu(i) {
  var m = D.menu, it = i >= 0 ? m.items[i] : null;
  if (it && (!it.index || it.grey)) return;          // a title, a rule or a greyed item: the menu stays
  D.menu = null;
  // The frame that asked runs again from where it started, and gets the answer.
  fx.v.set(D.menuSnap);
  D.host.choice = it ? it.index : 0;
  if (!it) { D.host.choice = 0; D.host.cancelled = true; }
  var g = mgraphics, sz = size();
  if (it) frame(g, sz, D.menuMouse);
  D.host.choice = 0;
  D.mouse.cap = 0;
  save();
  mgraphics.redraw();
}

// --------------------------------------------------------------- mouse --
// REAPER's mouse_cap: 1 left, 2 right, 4 Command, 8 Shift, 16 Option, 32 Control.
function caps(but, cmd, shift, opt, ctrl) {
  return (ctrl ? 2 : 1) | (cmd ? 4 : 0) | (shift ? 8 : 0) | (opt ? 16 : 0);
}
function onclick(x, y, but, cmd, shift, capslock, opt, ctrl) {
  if (D.menu) { chooseMenu(menuAt(x, y)); return; }
  D.mouse.x = x; D.mouse.y = y; D.mouse.cap = caps(but, cmd, shift, opt, ctrl);
  D.frameSaw = false;
  mgraphics.redraw();
}
function ondrag(x, y, but) {
  if (D.menu) return;
  D.mouse.x = x; D.mouse.y = y;
  if (!but) {
    // A click shorter than a frame is still seen down for one frame.
    if (D.frameSaw) D.mouse.cap = 0; else D.release = true;
    save();
  }
  mgraphics.redraw();
}
function onidle(x, y) {
  if (D.menu) { var i = menuAt(x, y); if (i !== D.menu.hover) { D.menu.hover = i; mgraphics.redraw(); } return; }
  D.mouse.x = x; D.mouse.y = y;
}
function onidleout() { if (!D.menu) { D.mouse.x = -1; D.mouse.y = -1; } }
function onwheel(x, y, dx, dy) { D.mouse.wheel += Math.round(dy * 120); mgraphics.redraw(); }

