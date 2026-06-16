# Loopi Sprite Animation Spec v1

## Cell Geometry

- Cell size: 256 x 280 px
- Columns (states): 3
- Rows per state: 6 frames
- Total frames: 18
- Spritesheet size: 768 x 1680 px (3 cols x 6 rows)
- Display size: max 340px wide (CSS), retina-ready at 2x
- Background: chroma key green `#00FF00` during generation, transparent in final

## Animation States

### 0 — idle (default loop)
- Action: Subtle breathing + slight body bob
- Frame variation: Chest expands/contracts, body moves up 2-3px, slight ear sway
- Loop: Continuous, ~1.2s cycle (200ms per frame)
- Constraints: No waving, no walking, no emotional reactions. Calm and low-distraction.

### 1 — waving (hover trigger)
- Action: One arm/paw raised in a small wave gesture
- Frame variation: Arm goes up, slight wave motion, comes back down
- Loop: Play once on hover, ~1s (167ms per frame)
- Constraints: Wave through limb pose only. No wave marks, sparkles, or floating effects.

### 2 — thinking (click trigger)
- Action: Head tilts to one side, slight lean, curious expression
- Frame variation: Head tilt progresses, one ear perks up, eyes shift slightly
- Loop: Play once on click, ~1.2s (200ms per frame)
- Constraints: No magnifying glass, papers, code, or new props. Expression only.

## Identity Lock (from Pet DNA v1.1)

Stable across ALL frames and ALL states:
- Silver-white body (#F2F5F7)
- Blue-purple gradient hair tuft (#8EA7FF → #9B7CFF)
- Blue-purple tail-like energy plume
- Cyan glow details (#5EEAD4) — forehead ring, chest light
- Warm cyan-blue eye highlights
- Minimal smart collar
- Virtual companion avatar feel — NOT literal horse/pony
- Friendly, intelligent expression — NOT childish or generic mascot

## Chroma Key

- Generation background: pure green `#00FF00`
- No chroma-adjacent colors in the pet body, highlights, or shadows
- Clean removal required — no green fringe on transparent edges

## File Outputs

- Spritesheet: `/assets/sprites/loopi-v02/spritesheet.webp` (transparent)
- Fallback: `/assets/sprites/loopi-v02/spritesheet.png` (transparent)
- Contact sheet: for QA review before deployment
