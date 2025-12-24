# Implement Live Preview for Design Selection (Step 2)

I will modify `app/routes/app._index.tsx` to enhance the "Choose a Style" step.

## 1. UI Restructure for Step 2
- **Split Layout:** Instead of just a grid of cards, I will implement a split layout similar to Step 3.
  - **Left Column:** The Grid of Design Presets (Clean, Bold, Glassy, Minimal).
  - **Right Column:** The Live Preview area (Mock Browser).

## 2. Interactive Preview Logic
- **State Management:**
  - I will use the existing `configOptions` state.
  - Clicking a preset will **no longer automatically advance** to the next step.
  - Instead, clicking a preset will:
    1. Update the `configOptions` state with the preset's values.
    2. Highlight the selected preset card (visual feedback).
    3. Instantly update the Live Preview on the right to reflect the new style.
  
## 3. Navigation
- Add a clear "Next" or "Continue" button below the preset grid or at the bottom of the left column.
- The user must explicitly click "Next" to confirm their choice and move to Step 3 (Customize).

## 4. Technical Details
- Reuse the `sticky-bar-preview` component logic from Step 3 for consistency.
- Ensure the preview in Step 2 uses the current `configOptions` so it reflects the selected preset immediately.
- Add a `selectedPresetId` state or derive it to style the active card.

## 5. Verification
- Verify that clicking a preset updates the preview.
- Verify that the preview looks correct for all 4 presets.
- Verify that clicking "Next" persists the state (in memory) and moves to Step 3.
- Verify "Back" button still works.