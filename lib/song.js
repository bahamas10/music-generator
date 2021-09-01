/*
 * Class for making music.
 *
 * Dave Eddy
 * August 30th 2021.
 */

var assert = require('assert-plus');
var MidiWriter = require('midi-writer-js');

// constants
var MIDI_BASE = 21; // A0 starts at midi note 21

// this is in 0-87 format (88 keys, A0 = 0)
var ALL_MINOR_NOTES = [];

(function () {
    for (var i = 0; i < 88; i++) {
        // check if in the minor scale (skipping 2nd)
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

// note lengths
var NOTE_TYPES = [
    {duration: 1,  chance: 10},  // whole note
    {duration: 2,  chance: 40},  // half note
    {duration: 4,  chance: 60},  // quarter note
    {duration: 8,  chance: 80},  // eight note
    {duration: 16, chance: 100}  // sixteenth note
];

// INDEXED AT 1 not 0
var LEFT_HAND_PATTERNS = [
    [
        {duration: '1', interval: 1}
    ],
    [
        {duration: '4', interval: 1},
        {duration: '4', interval: 5},
        {duration: '2', interval: 8}
    ],
    [
        {duration: '4', interval: 1},
        {duration: '4', interval: 5},
        {duration: '4', interval: 8},
        {duration: '4', interval: 5}
    ],
    [
        {duration: '4', interval: 1},
        {duration: '4', interval: 3},
        {duration: '2', interval: 5}
    ],
    [
        {duration: '2', interval: 1},
        {duration: '2', interval: 5}
    ],
    [
        {duration: '2', interval: 1},
        {duration: '2', interval: 8}
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

    assert.object(opts, 'opts');
    assert.number(opts.bpm, 'opts.bpm');
    assert.number(opts.transpose, 'opts.transpose');
    assert.object(opts.velocityRange, 'opts.velocityRange');
    assert.number(opts.velocityRange.min, 'opts.velocityRange.min');
    assert.number(opts.velocityRange.max, 'opts.velocityRange.max');
    assert.object(opts.sectionLengths, 'opts.sectionLengths');
    assert.number(opts.sectionLengths.leftHand, 'opts.sectionLengths.leftHand');
    assert.number(opts.sectionLengths.rightHand, 'opts.sectionLengths.rightHand');
    assert.optionalNumber(opts.beatsPerBar, 'opts.beatsPerBar');

    self._opts = opts;
    self.bpm = opts.bpm;
    self.transpose = opts.transpose;
    self.beatsPerBar = opts.beatsPerBar || 4;
    self.velocityRange = opts.velocityRange;
    self.sectionLengths = opts.sectionLengths;
    self.sections = {};
    self.midiData = null;

    if (opts.pattern) {
        self.generate(opts.pattern);
    }
}

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

        console.error('generating section %j', id);
        self.sections[id] = self.makeSection();
    });

    // append sections to notes
    pattern.forEach(function (id) {
        var section = self.sections[id];
        assert.object(section, 'section ' + id);

        leftHandNotes = leftHandNotes.concat(section.leftHandNotes);
        rightHandNotes = rightHandNotes.concat(section.rightHandNotes);
    });

    var song = new MidiWriter.Writer([
        self.newTrack(leftHandNotes),
        self.newTrack(rightHandNotes)
    ]);

    self.midiData = song;
};

Song.prototype.getMidiData = function getMidiData() {
    var self = this;

    assert(self.midiData, 'midi data not generated');

    return self.midiData.stdout();
};

Song.prototype.makeSection = function makeSection() {
    var self = this;

    var leftHandNotes = [];
    var rightHandNotes = [];

    var leftHandSectionLength = self.sectionLengths.leftHand;
    var rightHandSectionLength = self.sectionLengths.rightHand;
    var bars = lcm(leftHandSectionLength, rightHandSectionLength);
    console.error('makeSection bars = %j', bars);

    var lh = self.makeLeftHand(leftHandSectionLength);
    var rh = self.makeRightHand(rightHandSectionLength);

    var i;
    for (i = 0; i < bars; i += leftHandSectionLength) {
        leftHandNotes = leftHandNotes.concat(lh);
    }
    for (i = 0; i < bars; i += rightHandSectionLength) {
        rightHandNotes = rightHandNotes.concat(rh);
    }

    return {
        leftHandNotes: leftHandNotes,
        rightHandNotes: rightHandNotes
    };
};

Song.prototype.makeMelody = function makeMelody(bars) {
    var self = this;

    assert.number(bars, 'bars');

    var beats = bars * self.beatsPerBar;
    var arr = [];
    var sum = 0;

    while (true) {
        var num = randomInt(0, 100);
        var note;
        var add;

        var done = false;
        NOTE_TYPES.forEach(function (noteType) {
            if (done) {
                return;
            }

            if (num < noteType.chance) {
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

Song.prototype.makeLeftHand = function makeLeftHand(bars) {
    var self = this;

    assert.number(bars, 'bars');

    var notes = [];

    // make a chord progression (always start at root)
    var roots = [7];

    for (var i = 1; i < bars; i++) {
        var root;
        // filter out 2nd note from the minor scale
        while ((root = randomInt(0, 14)) % 7 === 1);

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
                    velocity: self.getVelocity(),
                    pitch: pitch,
                    duration: note.duration
                }
            });
        });
    });

    return notes;
};

Song.prototype.makeRightHand = function makeRightHand(bars) {
    var self = this;

    assert.number(bars, 'bars');

    var notes = [];

    var durations = self.makeMelody(bars);
    durations.forEach(function (duration) {
        var pitch = ALL_MINOR_NOTES[randomInt(0, 14)] + MIDI_BASE +
            self.transpose + 24;

        assert.number(pitch, 'pitch in range');

        var note = {
            type: 'note',
            payload: {
                velocity: self.getVelocity(),
                pitch: pitch,
                duration: duration
            }
        };

        notes.push(note);
    });

    return notes;
};

Song.prototype.getVelocity = function getVelocity() {
    var self = this;

    return randomInt(self.velocityRange.min, self.velocityRange.max);
};

Song.prototype.newTrack = function newTrack(notes) {
    var self = this;

    assert.arrayOfObject(notes, 'notes');

    var track = new MidiWriter.Track();

    track.setTempo(self.bpm);

    //track.addEvent(new MidiWriter.ProgramChangeEvent({instrument: 1}));

    // sustain pedal
    track.controllerChange(64, 127);

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
