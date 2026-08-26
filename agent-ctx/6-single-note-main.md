# Task 6-single-note - Work Record

## Agent: Main
## Task: Create SingleNotePractice component for focused single-note ear training

### Files Created
- `src/components/single-note-practice.tsx` — Full self-contained component (~460 lines)

### Files Modified
- `src/app/page.tsx` — Added import for SingleNotePractice, placed in right column after DailyStreak
- `worklog.md` — Appended task record

### Implementation Details
- **Pattern**: Collapsible card (teaser + expanded), matching warmup-module.tsx style
- **Pitch detection**: Independent AudioContext + AnalyserNode + autocorrelation (copied approach from pitch-detection.ts)
- **Note selection**: 7 natural notes (C-D-E-F-G-A-B) with Persian labels, 5 octaves (2-6)
- **Frequency calculation**: A4=440Hz, midi = (octave+1)*12 + noteIndex
- **Evaluation**: Correct (±5 cents, same note+octave) → emerald, wrong octave → amber, wrong → red
- **Timeout**: 8 seconds auto-stop
- **Stats**: total, correct, streak tracking
- **Lint**: Passes clean
- **Dev server**: Compiles successfully
