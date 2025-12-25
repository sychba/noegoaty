I will fix the mobile sticky bar layout to strictly follow the single-row "capsule" design shown in the user's reference.

### 1. Enforce Single-Row Layout (CSS)
- **Update `app/styles/customize.css`:**
  - Target `.preview-container.mobile .sb-main` with high specificity.
  - Force `flex-direction: row !important` and `flex-wrap: nowrap !important`.
  - Set a fixed, compact height (e.g., `64px`) to preventing expansion.
  - Remove any bottom/top margins from internal elements that might cause stacking.

### 2. Optimize Content for Mobile
- **Update `app/styles/customize.css`:**
  - **Thumbnail:** Ensure it stays small (36px).
  - **Title/Price:** Truncate text strictly to prevent pushing the button to a new line.
  - **Button:** Force `width: auto !important` (preventing full-width expansion) and use compact padding.
  - **Controls:** Hide variant/quantity selectors on mobile to ensure the "Image + Text + Button" fit cleanly in one line.

### 3. Refine "Floating" Position
- **Update `app/routes/app._index.tsx`:**
  - Adjust the inline style logic to ensure the bar floats with correct margins on mobile, matching the "Modern Glass" look (Screenshot 2) rather than a docked full-width bar.
