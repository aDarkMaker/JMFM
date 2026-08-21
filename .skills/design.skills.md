---
name: cirrus-design
description: Cirrus UI design system specification. Use when creating or modifying React/styled-components UI components (buttons, inputs, switches, cards, tooltips, pagination, navigation, etc.) to ensure visuals and interactions conform to the Cirrus style.
---

# Cirrus Design System

Distilled from 12 components (Button / Tabs / Search / Checkbox / Toggle / Notification / StatCard / Loader / Tooltip / Pagination / Radio / SidebarRail). Core character: **white surfaces, pill radii, ink primary, soft layered shadows, springy motion**.

## Design Tokens

All components must reference colors via CSS variables in the form `var(--color-x, fallback)`. Never hardcode raw values ad hoc.

| Token | Value | Usage |
|---|---|---|
| `--color-ink` | `#0e1116` | Primary: solid buttons, selected states, headings |
| `--color-cloud` | `#ffffff` | Surface background, inverted text |
| `--color-edge` | `#e3e8ee` | 1px borders |
| `--color-mist` | `#5b6472` | Secondary text, unselected icons |
| `--color-signal` | `#2e7def` | Focus, accent blue |
| `--color-citrus` | `#ff7a3d` | Badges, secondary accent orange |
| `--color-meadow` | `#2bc48a` | Positive deltas, success green |

Auxiliary values: hover ink `#1a1f28`; light fill `#f3f6fa` (chip/kbd/toggle track) with border `#eef2f6`; placeholder `#8a93a3`.

## Typography

- Font stack: `"Inter", system-ui, -apple-system, sans-serif`; large numerals and card titles use `"Inter Tight"` with Inter fallback.
- Weights: body 400 / labels 500 / titles 600 / numerals 700.
- Tracking is always negative: `letter-spacing: -0.005em` (body) down to `-0.025em` (36px hero numbers).
- All numbers: `font-variant-numeric: tabular-nums`.
- Size scale: 11 (chip) / 12.5 (description) / 13–14 (auxiliary) / 15 (body) / 18 (price) / 36 (hero stat).

## Shape & Elevation

- Radius semantics: **999px** = controls (buttons, inputs, pagination, tab bars, sidebar rail); **8px** = checkboxes; **14px** = icon tiles, tooltips; **20–22px** = option cards, notifications; **28px** = data cards.
- Height scale: controls 48px, tab items 36px, in-notification buttons 32px, kbd/chip 24–28px.
- Shadows always use two layers, colored from ink only: `0 1px 1px rgba(14,17,22,.04–.06)` + `0 18–24px 36–48px -18–-24px rgba(14,17,22,.18–.48)` (deepen the second layer on hover).
- Focus ring (the only permitted outer glow): `0 0 0 3px rgba(46,125,239,.32)`; card-level selection uses `.18` alpha + signal border.

## Motion

- Single easing curve: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo).
- Durations: transform 140ms; color/shadow/state 200–220ms; icon in/out 180ms.
- Micro-interaction conventions: hover arrow `translate(2px, -2px)`; active button `translateY(1px)`; checkmark `scale(.6) → 1`; loader dots pulse `scale` with 0.16s stagger (blue/orange/green).

## Implementation Patterns

1. **Structure**: styled-components in a single file, root `StyledWrapper`, BEM-style class names `cir-{block}__{el}--{mod}`.
2. **Visually hide native controls** (preserve semantics and keyboard access):

```css
input { position: absolute; opacity: 0; pointer-events: none; }
```

3. **State selector trio**: `input:checked + .box` (sibling styling), `input:focus-visible + .box` (focus ring), `.opt:has(input:checked)` (whole-card highlight).
4. **Accessibility requirements**: `role` / `aria-label` / `aria-current`; decorative SVGs get `aria-hidden="true"`; fieldset legends use `sr-only`.
5. **Interaction baseline**: `cursor: pointer` on all controls; hover shifts mist → ink or deepens the surface; `:focus-visible` removes outline in favor of the focus ring.

## Component Cheatsheet

- **Solid primary button**: 48px pill, ink background, cloud text, optional 16px arrow SVG.
- **Selected state**: ink pill/dot + small shadow; container stays cloud + edge border.
- **Color is garnish only**: signal/citrus/meadow appear solely in focus rings, badges, legend dots, loader dots — under 5% of surface area.

## Anti-Patterns (Forbidden)

- Colorful large buttons, gradient backgrounds, glassmorphism.
- Sharp-cornered controls or mixed radius semantics (e.g. a 12px button).
- Hardcoded colors bypassing tokens; positive letter-spacing; non-tabular numerals.
- Showing focus rings on `:focus` instead of `:focus-visible`; hiding native controls with `display: none`.
- Introducing new easing curves or state transitions longer than 220ms.
