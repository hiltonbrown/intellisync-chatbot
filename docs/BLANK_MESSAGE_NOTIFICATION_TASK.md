# Blank Message User Notification

## Planning

- [x] Investigate blank chat response root cause
- [x] Review message rendering in `components/message.tsx`
- [x] Create implementation plan

## Implementation

- [x] Add `isIncompleteMessage` helper function
- [x] Create `IncompleteMessageBanner` component
- [x] Integrate banner into `PurePreviewMessage`
- [x] Add regenerate action to banner

## Verification

- [x] Build passes successfully
- [ ] Manual test with interrupted stream
