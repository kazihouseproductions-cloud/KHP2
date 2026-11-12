# Desktop-1 Pin Variant2

Match the highlighted Makers pin in Desktop-1. Inspection through the Figma editor confirmed the instance uses Property 1 = Variant2. The API remains rate-limited, so measurements were read from the editor and the original options icon was exported through Figma's SVG export.

- Surface: 97.5 × 97.5px; white, fully rounded except a 12px top-right corner. Figma clamps the other 91px radii to half the surface size.
- Label: centered Inter Medium, 16.9px, #7024D4.
- Shadow: x=0, y=5.2px, blur=5.2px, spread=0, black at 25%.
- Options: original 14 × 14px three-ring SVG, offset 6.25px from the surface's right edge and 5.15px from its top. No separate button bubble. Retain a larger invisible pointer/focus target.
- Apply the variant on hover, keyboard focus, and while its actions are open; show it directly on devices without hover. Scale surface measurements with the existing pin size, including ancestor pins.
- Preserve Add Member, Members, Edit, and two-step Delete behavior.

Verification: all 10 existing tests, lint, and the production build passed. At the 1920px Figma reference width, browser measurements confirmed a 97.5px surface, 12px top-right radius, 16.9px/500 label, 0/5.2px/5.2px/25% shadow, and a loaded 14px SVG positioned 6.25px from the right and 5.15625px from the top (browser pixel rounding of 5.15px). The idle state hides the options icon; keyboard focus reveals Variant2. Pointer activation opens all four actions and a second activation closes the menu. The larger invisible hit target retains an accessible keyboard focus indicator.
