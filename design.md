1. Project Purpose & Context
Create a modular, ultra-modern, and scalable UI kit for a cloud SaaS platform that automates monthly Meta (Facebook/Instagram) Ads campaign reporting.
Audience: Freelance/agency admins and their non-technical clients, both viewing campaign KPIs and PDF reports via responsive dashboards.

2. Core Principles
Radical Simplicity: Only show what matters; no clutter, minimalism-first, always clear.

Effortless Hierarchy: Prioritise the “main number” and trend, then secondary info. Key actions always visible.

Instant Clarity: Layouts must be immediately understandable by non-technical users—no “data dump” feeling.

Ready for White-Label: Brand-neutral by default (easy to skin); avoid loud colors, mascots, or heavy graphics.

Responsiveness: Mobile-first, but beautiful and readable on any device.

Accessibility: WCAG AA as a baseline (fonts, contrasts, focus states).

3. Visual Style & Branding
Look & Feel:

Neutral, trustworthy, modern, “agency-ready”

Plenty of whitespace (don’t crowd dashboards)

Subtle card backgrounds, soft shadows for depth (but minimal, not playful)

Minimal but effective use of accent color (for highlights, CTAs)

Example: white/grey background, blue or teal accent, black/grey for text

Typography:

Sans-serif only. Prioritise legibility and calm, professional vibes.

Primary recommendation: Inter or SF Pro

Font sizes:

Main KPIs: 2xl–3xl (bold, 28–36px desktop, 22–28px mobile)

Secondary labels: medium (16–18px)

Body: regular (15–16px), never smaller than 14px

Color Palette:

Background: White (#FFFFFF) or light grey (#F8FAFC or #F3F4F6)

Cards: White with soft shadow or border

Text: #111827 (main), #6B7280 (secondary)

Accent: #2563EB (blue) or #14B8A6 (teal)

Alerts/Warnings: #F59E42 (orange), #EF4444 (red) — only if needed

Border: #E5E7EB

Spacing & Sizing:

Use a 4pt or 8pt spacing system (consistent vertical/horizontal padding)

Card padding: 24–32px (desktop), 16–20px (mobile)

Space between cards/sections: at least 32px desktop, 20px mobile

Inputs/buttons: min height 44px (tap area), border radius 8–12px

UI Components:

Cards: Use for all data displays and KPIs; visually grouped, never crowded

Graphs: Bar, line, and trend indicators only; avoid pie/donut in MVP

Buttons: Rounded corners, high contrast for primary actions, minimal icon use

Inputs: Clear, obvious, with focus/active states (see accessibility)

Nav: Persistent, simple topbar or minimal sidebar (collapsible on mobile)

Tables (if needed): Striped rows, sticky header, never more than 6 columns in view

4. Information Hierarchy & Layout
Dashboard (Admin & Client):

Primary KPI at top/center (e.g., “Monthly Spend”, “Leads Generated”)

Secondary KPIs/cards below (trend, CTR, impressions, reach, cost per result)

Recent Reports: Easy download button (PDF), simple status/tag (sent/failed)

Quick action: “Send Report Now” (admin only)

Profile/settings: Top right, minimal dropdown

Mobile: Stack cards, sticky nav/actions, floating action button for main task

Report View (Client):

List of reports (date, main metric, download button)

Clear “View Report” and “Download PDF” buttons

KPIs: Large, separated, with short plain-language summary (“Ad spend up 12% vs last month”)

5. Responsiveness & Accessibility
Mobile:

Stack cards vertically

Hide secondary info behind “show more” where possible

Big tap areas, sticky actions (bottom nav or floating CTA)

Accessibility:

All text high-contrast (at least 4.5:1 ratio)

Focus states on all interactive elements

Keyboard navigable; aria-labels on important components

Minimum font 14px everywhere

6. Styleguide Example (for dev handoff)
Font: Inter, fallback: system-ui, sans-serif

Color tokens:

css
Copy
Edit
--bg-default: #FFFFFF;
--bg-card: #F8FAFC;
--text-primary: #111827;
--text-secondary: #6B7280;
--accent: #2563EB;
--border: #E5E7EB;
--error: #EF4444;
Box shadow: 0 2px 8px rgba(16, 30, 54, 0.07)

Radius: 8px

Spacing: 8, 16, 24, 32, 40 (px)

7. Design Inspiration References
Reference modern SaaS like Linear, Notion, Stripe Dashboard, Superhuman (for focus)

Use Figma/React best practices for modularity and handoff

8. Deliverables
Component library: Button, Card, Input, Chart, Report List, Notification

Responsive layouts: Admin Dashboard, Client Dashboard, Login, Report View

Styleguide: Colors, Typography, Spacing, Iconography, Component States

9. Don’ts
No data overload, no pie/donut charts, no gamification, no playful mascots

No aggressive colors, no unnecessary animations, no “fancy” backgrounds

GOAL:
Design a modern, frictionless reporting dashboard that feels instantly familiar, trustworthy, and clean—maximising clarity and utility for both admins and clients, and ready for agency branding.

