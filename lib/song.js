/*
 * Class for making music.
 *
 * Dave Eddy
 * August 30th 2021.
 * License: MIT
 */

var events = require('events');
var util = require('util');

var assert = require('assert-plus');
var MidiWriter = require('midi-writer-js');

// constants
var MIDI_BASE = 21; // A0 starts at midi note 21

// this is in 0-87 format (88 keys, A0 = 0)
var ALL_MINOR_NOTES = [];

(function () {
    // loop all possible keys, keep the ones in a minor scale
    for (var i = 0; i < 88; i++) {
        var base = i % 12;

        switch (base) {
        case 0:
        case 2:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
            ALL_MINOR_NOTES.push(i);
            break;
        }
    }
})();

// note lengths (chance is a %, should add up to 100)
var NOTE_TYPES = [
    {duration: 1,  chance: 10},  // whole note
    {duration: 2,  chance: 30},  // half note
    {duration: 4,  chance: 20},  // quarter note
    {duration: 8,  chance: 20},  // eight note
    {duration: 16, chance: 20}   // sixteenth note
];

// INDEXED AT 1 not 0
var LEFT_HAND_PATTERNS = [
    [
        {duration: 1, interval: 1}
    ],
    [
        {duration: 4, interval: 1},
        {duration: 4, interval: 5},
        {duration: 2, interval: 8}
    ],
    [
        {duration: 4, interval: 1},
        {duration: 4, interval: 5},
        {duration: 4, interval: 8},
        {duration: 4, interval: 5}
    ],
    [
        {duration: 4, interval: 1},
        {duration: 4, interval: 3},
        {duration: 2, interval: 5}
    ],
    [
        {duration: 2, interval: 1},
        {duration: 2, interval: 5}
    ],
    [
        {duration: 2, interval: 1},
        {duration: 2, interval: 8}
    ]
];

module.exports.Song = Song;

/*
 * Create random int between "low" (inclusive) and "high" (exclusive).
 */
function randomInt(low, high) {
    var diff = high - low;

    return Math.floor(Math.random() * diff) + low;
}

/*
 * Get a random item from an array.
 */
function randomElementFromArray(arr) {
    var num = randomInt(0, arr.length);

    return arr[num];
}

/*
 * Lowest common multiple.
 */
function lcm(x, y) {
    function gcd(x, y) {
        x = Math.abs(x);
        y = Math.abs(y);
        while (y) {
            var t = y;
            y = x % y;
            x = t;
        }
        return x;
    }

    assert.number(x, 'x');
    assert.number(y, 'y');

    return Math.abs((x * y) / gcd(x, y));
}

function Song(opts) {
    var self = this;

    events.EventEmitter.call(self);

    assert.object(opts, 'opts');
    assert.number(opts.bpm, 'opts.bpm');
    assert.number(opts.transpose, 'opts.transpose');
    assert.object(opts.velocityRange, 'opts.velocityRange');
    assert.number(opts.velocityRange.min, 'opts.velocityRange.min');
    assert.number(opts.velocityRange.max, 'opts.velocityRange.max');
    assert.object(opts.sectionLengths, 'opts.sectionLengths');
    assert.number(opts.sectionLengths.leftHand, 'opts.sectionLengths.leftHand');
    assert.number(opts.sectionLengths.rightHand, 'opts.sectionLengths.rightHand');
    assert.object(opts.leftHandRange, 'opts.leftHandRange');
    assert.number(opts.leftHandRange.min, 'opts.leftHandRange.min');
    assert.number(opts.leftHandRange.max, 'opts.leftHandRange.max');
    assert.number(opts.leftHandRange.root, 'opts.leftHandRange.root');
    assert.object(opts.rightHandRange, 'opts.rightHandRange');
    assert.number(opts.rightHandRange.min, 'opts.rightHandRange.min');
    assert.number(opts.rightHandRange.max, 'opts.rightHandRange.max');
    assert.bool(opts.sustain, 'opts.sustain');
    assert.optionalNumber(opts.beatsPerBar, 'opts.beatsPerBar');

    self._opts = opts;
    self.bpm = opts.bpm;
    self.transpose = opts.transpose;
    self.beatsPerBar = opts.beatsPerBar || 4;
    self.velocityRange = opts.velocityRange;
    self.sectionLengths = opts.sectionLengths;
    self.leftHandRange = opts.leftHandRange;
    self.rightHandRange = opts.rightHandRange;
    self.sustain = opts.sustain;
    self.sections = {};
    self.midiData = null;

    if (opts.pattern) {
        self.generate(opts.pattern);
    }
}

util.inherits(Song, events.EventEmitter);

Song.prototype._log = function _log() {
    var self = this;

    var s = util.format.apply(util, arguments);

    self.emit('log', s);
};

Song.prototype.generate = function (pattern) {
    var self = this;

    assert.string(pattern, 'pattern');

    var leftHandNotes = [];
    var rightHandNotes = [];

    pattern = pattern.split('');

    // make sections
    pattern.forEach(function (id) {
        if (self.sections.hasOwnProperty(id)) {
            return;
        }

        self._log('generating section "%s"', id);
        self.sections[id] = self._makeSection();
    });

    // append sections to notes
    pattern.forEach(function (id) {
        var section = self.sections[id];
        assert.object(section, 'section ' + id);

        leftHandNotes = leftHandNotes.concat(section.leftHandNotes);
        rightHandNotes = rightHandNotes.concat(section.rightHandNotes);
    });

    var song = new MidiWriter.Writer([
        self._newTrack(leftHandNotes),
        self._newTrack(rightHandNotes)
    ]);

    self.midiData = song;
};

Song.prototype.getMidiData = function getMidiData() {
    var self = this;

    assert(self.midiData, 'midi data not generated');

    self._log('generating midi data');

    return self.midiData.stdout();
};

Song.prototype._makeSection = function _makeSection() {
    var self = this;

    var leftHandNotes = [];
    var rightHandNotes = [];

    var leftHandSectionLength = self.sectionLengths.leftHand;
    var rightHandSectionLength = self.sectionLengths.rightHand;
    var bars = lcm(leftHandSectionLength, rightHandSectionLength);

    var lh = self._makeLeftHand(leftHandSectionLength);
    var rh = self._makeRightHand(rightHandSectionLength);

    var i;
    for (i = 0; i < bars; i += leftHandSectionLength) {
        leftHandNotes = leftHandNotes.concat(lh);
    }
    for (i = 0; i < bars; i += rightHandSectionLength) {
        rightHandNotes = rightHandNotes.concat(rh);
    }

    var data = {
        leftHandNotes: leftHandNotes,
        rightHandNotes: rightHandNotes
    };

    self._filterDissonance(data);

    return data;
};

Song.prototype._filterDissonance = function _filterDissonance(data) {
    var self = this;

    assert.object(data, 'data');
    assert.arrayOfObject(data.leftHandNotes, 'data.leftHandNotes');
    assert.arrayOfObject(data.rightHandNotes, 'data.rightHandNotes');

    function buildMap(notes) {
        var map = {};
        var sum = 0;

        notes.forEach(function (obj) {
            assert.object(obj, 'obj');
            if (obj.type !== 'note') {
                return;
            }
            var noteType = obj.payload;

            map[sum] = obj.payload;
            sum += self.beatsPerBar / noteType.duration;
        });

        return map;
    }

    // build a map of duration -> note
    var leftHandMap = buildMap(data.leftHandNotes);
    var rightHandMap = buildMap(data.rightHandNotes);

    // find overlapping notes
    Object.keys(leftHandMap).forEach(function (key) {
        var ln = leftHandMap[key];
        var rn = rightHandMap[key];

        if (!rn) {
            return;
        }

        switch (rn.pitch - ln.pitch) {
        case -1:
        case 0:
        case 1:
            self._log('filtering dissonance - ln.p = %d, rn.p = %d', ln.pitch, rn.pitch);
            rn.velocity = 0;
            break;
        }
    });
};

Song.prototype._makeMelody = function _makeMelody(bars) {
    var self = this;

    assert.number(bars, 'bars');

    var beats = bars * self.beatsPerBar;
    var arr = [];
    var sum = 0;

    while (true) {
        var chance = 0;
        var num = randomInt(0, 100);
        var note;
        var add;

        var done = false;
        NOTE_TYPES.forEach(function (noteType) {
            if (done) {
                return;
            }

            chance += noteType.chance;
            if (num < chance) {
                note = noteType.duration;
                add = self.beatsPerBar / noteType.duration;
                done = true;
            }
        });
        assert(done, 'error making melody');

        // check if this note would push us over our limit
        if (sum + add > beats) {
            // too many notes, pad to finish
            NOTE_TYPES.forEach(function (noteType) {
                var add = self.beatsPerBar / noteType.duration;

                while (sum + add <= beats) {
                    arr.push(noteType.duration);
                    sum += add;
                }
            });

            assert.equal(sum, beats, 'beat mismatch');
            break;
        }

        sum += add;
        arr.push(note);
    }

    return arr;
};

Song.prototype._makeLeftHand = function _makeLeftHand(bars) {
    var self = this;

    assert.number(bars, 'bars');

    var minNote = self.leftHandRange.min;
    var maxNote = self.leftHandRange.max;
    var notes = [];
    var roots = [];

    // make a chord progression (always start at root)
    roots.push(self.leftHandRange.root);
    for (var i = 1; i < bars; i++) {
        var root;
        // filter out 2nd note from the minor scale
        while ((root = randomInt(minNote, maxNote)) % 7 === 1);

        roots.push(root);
    }

    roots.forEach(function (root) {
        // create a pattern
        var pattern = randomElementFromArray(LEFT_HAND_PATTERNS);

        pattern.forEach(function (note) {
            var pitch = ALL_MINOR_NOTES[(note.interval - 1) + root] +
                MIDI_BASE + self.transpose;

            assert.number(pitch, 'pitch in range');

            notes.push({
                type: 'note',
                payload: {
                    velocity: self._getVelocity(),
                    pitch: pitch,
                    duration: '' + note.duration
                }
            });
        });
    });

    return notes;
};

Song.prototype._makeRightHand = function _makeRightHand(bars) {
    var self = this;

    assert.number(bars, 'bars');

    var notes = [];
    var minNote = self.rightHandRange.min;
    var maxNote = self.rightHandRange.max;
    var lastPitch;
    var pitchCount = 0;
    var maxPitchInARow = 1;

    var durations = self._makeMelody(bars);
    durations.forEach(function (duration) {
        var pitch;

        while (true) {
            pitch = ALL_MINOR_NOTES[randomInt(minNote, maxNote)] + MIDI_BASE +
                self.transpose;

            if (pitch !== lastPitch) {
                pitchCount = 0;
                break;
            }

            if (++pitchCount >= maxPitchInARow) {
                // too many in a row, regen]
            } else {
                break;
            }
        }
        lastPitch = pitch;

        assert.number(pitch, 'pitch in range');

        var note = {
            type: 'note',
            payload: {
                velocity: self._getVelocity(),
                pitch: pitch,
                duration: duration
            }
        };

        notes.push(note);
    });

    return notes;
};

Song.prototype._getVelocity = function _getVelocity() {
    var self = this;

    return randomInt(self.velocityRange.min, self.velocityRange.max);
};

Song.prototype._newTrack = function _newTrack(notes) {
    var self = this;

    assert.arrayOfObject(notes, 'notes');

    var track = new MidiWriter.Track();

    track.setTempo(self.bpm);

    //track.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 1}));

    // sustain pedal
    if (self.sustain) {
        track.controllerChange(64, 127);
    }

    // add notes given
    notes.forEach(function (note) {
        switch (note.type) {
        case 'note':
            track.addEvent(new MidiWriter.NoteEvent(note.payload));
            break;
        case 'marker':
            track.addMarker(note.payload);
            break;
        default:
            assert(false, 'unknown note type: ' + note.type);
        }
    });

    return track;
};
