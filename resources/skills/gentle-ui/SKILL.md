---
name: gentle-ui
description: "Trigger: gentle-ai, Gentle-AI, diseño gentle, estilo gentle, interfaz visual, UI web, desktop, TUI, terminal, tema rose pine. Aplica los principios de diseño de Gentle-AI a UIs web, desktop y TUI."
license: MIT
metadata:
  author: andy
  version: "1.0"
---

# Gentle-AI Design System

## Activation Contract

**Use this skill when:**
- Generating or modifying UI components (web, desktop, TUI) for the Gentle-AI or Gentleman Programming ecosystem.
- User requests "gentle-ai style", "estilo gentle", "diseño gentle", or a dark-first zinc/magenta or Rose Pine UI.

**Do NOT use this skill for:**
- Backend, API, or infrastructure only changes.
- Non-Gentle-AI design systems without explicit request.

## Hard Rules

| Rule | Description |
|------|-------------|
| **Dark-first** | If generating light mode, invert the gray scale keeping `#ea1889` as accent. |
| **Single chromatic accent** | Do not introduce additional colors outside the defined palette. |
| **Typography hierarchy** | Maximum 3 distinct weights per view. |
| **Subtle borders** | `#ffffff12`, never pure hard lines. |
| **Consistent radii** | 8px controls, 16px cards. |
| **Spacing** | Multiples of 4px. |

## Decision Gates

| Situation | Action |
|-----------|--------|
| Request targets Gentle-AI ecosystem | Apply full Gentle-AI design system |
| Request is for non-Gentle-AI UI | Use generic ui-design skill instead |
| Dark mode requested | Use zinc/magenta (web) or Rose Pine (TUI) |
| Light mode requested | Invert gray scale, keep magenta accent |

## Execution Steps

1. **Detect context** — Determine if request targets Gentle-AI ecosystem or generic UI.
2. **Apply tokens** — Use zinc/magenta (web) or Rose Pine (TUI) tokens.
3. **Apply structure** — Fixed nav, max-w-6xl container, transition-colors on interactives.
4. **Verify compliance** — Check all Hard Rules are satisfied.

## Output Contract

Return design decisions with:
- Color palette and tokens
- Typography scale and weights
- Spacing and radius values
- Component structure patterns
- Compliance verification against Hard Rules

## References

- `ui-design` skill — UI/UX decisions checklist
- `ui-ux-principles` skill — HCD, Nielsen, WCAG 2.2
- `gentle-design` skill — Design canvas, artboards, handoff (external: gentle-pi package)