# Configurable Image Format & Quality PRD

## Summary
Enable users of the YouTube frame capture extension to choose whether captured screenshots are saved as PNG or JPEG files and to fine-tune the output quality. The feature introduces lightweight preferences exposed directly within the extension UI (quick toggle) and optionally persisted between sessions. This builds on the existing capability to capture a video frame and download it as a PNG.

## Goals
- Allow users to switch the capture output between PNG and JPEG before saving a frame.
- Allow users to adjust the JPEG quality level (0–100%) with sensible defaults and guardrails.
- Persist the user's chosen options so subsequent captures use the preferred configuration without repeated setup.
- Maintain a streamlined capture flow with minimal additional clicks.

## Non-Goals
- Supporting additional file formats beyond PNG and JPEG.
- Advanced image editing such as cropping, annotations, or overlays.
- Cloud storage or automatic uploads of captured frames.
- Per-video presets or profile-based configurations.

## Assumptions
- Users primarily capture single frames and prefer a simple inline control over a full options page for frequent toggling.
- PNG remains the highest fidelity default for lossless captures; JPEG affords reduced file size when configured with appropriate quality.
- Storage and sync APIs (chrome.storage.sync/local) are available in the extension environment to persist preferences.

## Functional Requirements

| Requirement ID | Description | User Story | Expected Behavior/Outcome |
|----------------|-------------|------------|---------------------------|
| FR001 | Selecting PNG output | As a user, I want to save captures as PNG so that I can retain lossless image quality. | The UI exposes a PNG option; when selected, subsequent captures produce `.png` files using lossless encoding. |
| FR002 | Selecting JPEG output | As a user, I want to save captures as JPEG so that my files are smaller and easier to share. | Selecting the JPEG option changes the output extension to `.jpg` and applies JPEG encoding using the currently configured quality level. |
| FR003 | Adjusting JPEG quality | As a user, I want to control the JPEG quality so that I can balance between fidelity and file size. | A quality control (slider or numeric input) is available when JPEG is selected, accepts values between 10% and 100%, and affects the generated JPEG blob accordingly. |
| FR004 | Persisting user preferences | As a user, I want the extension to remember my last chosen format and quality so I don't need to reconfigure each time. | The selected format and quality are saved (e.g., via `chrome.storage.sync`) and automatically restored on subsequent page loads and captures. |
| FR005 | Inline feedback & validation | As a user, I want feedback when I select invalid values or switch formats, so I understand the resulting capture. | Quality input validates bounds, shows helper text or toast for invalid entries, and disables or hides the quality control when PNG is selected. |
| FR006 | Discoverability & minimal friction | As a user, I want the controls to be easy to find without cluttering the video player area. | Format toggle and quality control are co-located with the capture button in a compact layout, keyboard accessible, and responsive to theme changes. |
| FR007 | Backward compatibility | As an existing user, I expect captures to continue working even if I never interact with new controls. | Default state remains PNG at full quality; if users ignore controls, captures behave exactly like the current implementation. |

## User Stories & Acceptance Criteria

### Story 1: Switch between PNG and JPEG
- **Given** the capture controls are rendered on a YouTube watch page
- **When** the user selects the PNG option
- **Then** the capture button text/icon reflects PNG is active (e.g., tooltip or pill) and the downloaded file uses `.png` extension
- **And** the filename generation logic continues to append `.png`
- **When** the user selects the JPEG option
- **Then** subsequent captures use `.jpg` extension and the JPEG encoder runs with the last chosen quality value

### Story 2: Adjust JPEG quality
- **Given** JPEG format is active
- **When** the user adjusts the quality slider to a valid value (e.g., 80%)
- **Then** future captures use that value in `canvas.toBlob` (or equivalent), producing visibly smaller files at lower qualities
- **When** the user provides an out-of-range value
- **Then** an inline validation message appears and the control is clamped to the nearest valid value (10–100)

### Story 3: Persist user preferences
- **Given** the user adjusts the format/quality and leaves the page or closes the browser
- **When** they reopen YouTube or reload the extension
- **Then** the previously selected format and quality are restored without additional interaction

### Story 4: Accessibility & usability
- **Given** a keyboard-only user
- **When** they tab through the controls
- **Then** the format toggle and quality input are focusable in a logical order with visible focus rings
- **And** assistive technology receives ARIA labels describing each control and its current value

## Edge Cases & Considerations
- Restrict quality to an integer range (default 90) to avoid confusion with floating-point percentages.
- When switching from JPEG back to PNG, hide or disable the quality slider to reduce clutter.
- Ensure rapid successive captures do not break preference persistence (debounce storage writes).
- Maintain responsive layout for differing YouTube player sizes and themes.
- Provide fail-safe defaults if storage retrieval fails (fallback to in-memory defaults).

## Success Metrics
- Zero regression in existing PNG capture behavior for users who never change settings.
- Users can switch formats and see corresponding file extension and size changes without reloading the page.
- Preferences persist across at least three separate browser sessions in manual QA.

## Open Questions
- Should the quality slider be global (persisted) or per-session? (Assumed persisted.)
- Do we need an options page for advanced settings, or is inline control sufficient? (Assumed inline is acceptable for this iteration.)
- Should JPEG quality default to 85 or 90? (Assumed 90; can adjust after testing.)
