---
name: karttamaster-design
description: Use this skill to generate well-branded interfaces and assets for Karttamaster (SyöteMTB 2026 trail-sign tool), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the organizer (desktop) and volunteer (mobile) experiences.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files (`styles.css` + `tokens/`, `components/`, `ui_kits/`, `guidelines/`).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Link `styles.css`, set `data-theme="dark"` (organizer) or `data-theme="daylight"` (volunteer) on the root, and compose the components. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

Key things to honour:
- **Two contexts.** Organizer = dark, desktop, power tools. Volunteer = daylight (recommended), mobile, one dominant action, max 2 taps. Decide which you're designing for first.
- **44px touch minimum**, always. 4px spacing grid. Tight 11–14px type (drive-mode 28–40px is the only exception).
- **Finnish copy**, plain and calm, sentence-case buttons / UPPERCASE section headers. Status vocabulary: suunniteltu → asetettu → tarkistettu → kerätty (+ ei tarpeen).
- **One amber accent** for the single most important action; green for confirm; soft red for danger.

If the user invokes this skill without other guidance, ask them what they want to build or design, ask some clarifying questions (which persona, which phase, dark or daylight), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
