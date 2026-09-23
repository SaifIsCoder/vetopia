# Design System & UI Components — Vetopia Mobile MVP

This document specifies the mobile design system, color palette, typography scale, elevation, and atomic reusable components for **Vetopia Mobile**. All styles are extracted from the existing website tokens (`src/styles.css`) and translated for React Native.

---

## 1. Color Palette

```
Brand Primary (Lime):       #A8E831  ████████  [oklch(0.88 0.21 130)]
Brand Lime Deep:            #88C71B  ████████  [oklch(0.78 0.22 134)]
Brand Ink (Dark/Header):    #131616  ████████  [oklch(0.18 0.01 250)]
Brand Ink Soft:             #303636  ████████  [oklch(0.32 0.01 250)]
Brand Cream (Light Base):   #FAF9F5  ████████  [oklch(0.985 0.005 100)]
Brand Surface (Cards/Pills):#F2F4EE  ████████  [oklch(0.96 0.01 130)]
Border Subtle:              #E2E5DC  ████████  [oklch(0.9 0.01 130)]
Destructive / Emergency:    #DC2626  ████████  [oklch(0.6 0.22 27)]
Success / Online Status:    #16A34A  ████████  [oklch(0.75 0.18 140)]
```

### 1.1 Color Tokens Specification
* **`theme.colors.primary`:** `#A8E831` (Vivid Lime) — Main call-to-action buttons, active tab indicators, verified shield badges.
* **`theme.colors.primaryDark`:** `#88C71B` (Deep Lime) — Focus rings, active borders, rating stars.
* **`theme.colors.ink`:** `#131616` (Near-Black Charcoal) — High-contrast primary buttons, dark mode background, primary text.
* **`theme.colors.inkSoft`:** `#303636` (Soft Charcoal) — Secondary text in dark mode, card header text.
* **`theme.colors.cream`:** `#FAF9F5` (Off-White Cream) — Screen canvas background in light mode.
* **`theme.colors.surface`:** `#F2F4EE` (Warm Surface) — Card backgrounds, input fill, pill chip backgrounds.
* **`theme.colors.border`:** `#E2E5DC` — 1px dividers, card outlines, subtle borders.
* **`theme.colors.destructive`:** `#DC2626` (Crimson) — Red-flag emergency triage alerts, end-call buttons, cancellations.
* **`theme.colors.success`:** `#16A34A` (Forest Green) — Online doctor status beacon, completed consultation badge.

---

## 2. Typography Scale

Vetopia Mobile uses **Space Grotesk** for display headers and numbers, and **Inter** for all clinical descriptions, body copy, and UI controls.

| Token | Family | Size (pt) | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `typography.displayLg` | SpaceGrotesk-Bold | 32 | 38 | 700 | Welcome screen hero title |
| `typography.displayMd` | SpaceGrotesk-Bold | 26 | 32 | 700 | Dashboard headlines, price tags |
| `typography.headingLg` | SpaceGrotesk-Bold | 20 | 26 | 700 | Doctor name, modal headings |
| `typography.headingMd` | Inter-SemiBold | 17 | 22 | 600 | Section headers, card titles |
| `typography.bodyLg` | Inter-Regular | 16 | 22 | 400 | Chat messages, intake descriptions |
| `typography.bodyMd` | Inter-Regular | 14 | 20 | 400 | Standard body, input field text |
| `typography.bodySm` | Inter-Medium | 12 | 16 | 500 | Metadata, timestamps, helper text |
| `typography.caption` | Inter-SemiBold | 10 | 14 | 600 | Pill tags, status badges |
| `typography.button` | SpaceGrotesk-Bold | 14 | 18 | 700 | Uppercase primary action labels |

---

## 3. Spacing, Radii & Shadows

### Spacing Scale
```text
4pt   -> xs
8pt   -> sm
12pt  -> md
16pt  -> standard gutter / screen horizontal padding
20pt  -> lg
24pt  -> xl
32pt  -> 2xl (section spacing)
48pt  -> 3xl (screen header top padding)
```

### Corner Radii
* `radius.sm`: 8pt (Input fields, dropdown containers)
* `radius.md`: 12pt (Buttons, media thumbnails)
* `radius.lg`: 16pt (Standard cards, appointment cards)
* `radius.xl`: 24pt (Bottom sheets, modal dialogs)
* `radius.pill`: 9999pt (Status chips, pill buttons, category badges)

### Shadows / Elevation
* **Card Lift (`elevation.card`):**
  * iOS: `shadowColor: '#131616'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.08`, `shadowRadius: 10`.
  * Android: `elevation: 3`.
* **Action Sheet (`elevation.sheet`):**
  * iOS: `shadowColor: '#131616'`, `shadowOffset: { width: 0, height: -6 }`, `shadowOpacity: 0.12`, `shadowRadius: 16`.
  * Android: `elevation: 8`.

---

## 4. Reusable Atomic Components Specification

### 4.1 Buttons (`Button.tsx`)
* **Variants:**
  * `primary`: Background `#A8E831`, text `#131616`, bold all-caps text, pill shape, active opacity `0.85`.
  * `secondary`: Background `#131616`, text `#FAF9F5`, pill shape.
  * `outline`: Transparent background, 2px border `#131616`, text `#131616`.
  * `destructive`: Background `#DC2626`, text `#FAF9F5`, pill shape (used for End Call and Cancel).
  * `ghost`: Transparent background, text `#131616`, no border.
* **States:** Normal, Pressed, Disabled (opacity 0.45), Loading (replaces text with activity indicator).
* **Touch Target:** Minimum height `48pt`.

### 4.2 Form Inputs (`Input.tsx`)
* **Properties:** Label text, placeholder, secure entry toggle, left icon, error helper text.
* **Styling:** Height `48pt`, background `#F2F4EE`, border 1px `#E2E5DC`, active focus border 2px `#88C71B`.

### 4.3 Cards (`Card.tsx`)
* **Styling:** Background `#FFFFFF`, border 1px `#E2E5DC`, border radius `16pt`, padding `16pt`, shadow `elevation.card`.

### 4.4 Status Badges (`Badge.tsx`)
* **Variants:**
  * `verified`: Background `#A8E831`, text `#131616`, checkmark icon.
  * `scheduled`: Background `#F2F4EE`, text `#303636`.
  * `completed`: Background `#16A34A`, text `#FAF9F5`.
  * `cancelled`: Background `#DC2626`, text `#FAF9F5`.

### 4.5 Bottom Sheets (`BottomSheet.tsx`)
* **Implementation:** Built using `@gorhom/bottom-sheet`.
* **Behavior:** Gesture-driven drag handle, snap points `['35%', '65%', '90%']`, backdrop dimming with blur overlay.
