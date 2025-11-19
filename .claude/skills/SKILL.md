---
name: Frontend Design Skill
description: Apply best practices for building richer, more customized frontend design. Improves typography, color themes, animations, and backgrounds to avoid generic AI-generated aesthetics.
version: 1.0.0
---

# Frontend Design Best Practices

This skill helps Claude generate distinctive, high-quality frontend designs that avoid the common "AI slop" aesthetic.

## Core Principle

Think like a frontend engineer: map aesthetic improvements to implementable code (typography, themes, animations, backgrounds).

## Design Guidelines

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:

- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for performance.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:

- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

## Typography Guidelines

<use_interesting_fonts>
Typography instantly signals quality. Avoid using boring, generic fonts.

Never use: Inter, Roboto, Open Sans, Lato, default system fonts

Here are some examples of good, impactful choices:

- Code aesthetic: JetBrains Mono, Fira Code, Space Grotesk
- Editorial: Playfair Display, Crimson Pro
- Technical: IBM Plex family, Source Sans 3
- Distinctive: Bricolage Grotesque, Newsreader

Pairing principle: High contrast = interesting. Display + monospace, serif + geometric sans, variable font across weights.

Use extremes: 100/200 weight vs 800/900, not 400 vs 600. Size jumps of 3x+, not 1.5x.

Pick one distinctive font, use it decisively. Load from Google Fonts.
</use_interesting_fonts>

## Implementation Notes

When applying these guidelines:

1. Start with typography - it has the biggest impact
2. Choose a cohesive color theme that matches the project context
3. Add subtle animations for micro-interactions
4. Create depth with layered backgrounds
5. Test across different viewport sizes
6. Ensure accessibility (contrast ratios, font sizes)

Remember: The goal is to create designs that feel intentionally crafted, not algorithmically generated.
