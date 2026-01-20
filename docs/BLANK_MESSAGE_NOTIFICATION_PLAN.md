# Blank Message User Notification

Display a user-friendly message when an assistant response is incomplete due to stream interruption, allowing users to regenerate the response.

## Background

When a streaming response is interrupted (e.g., user navigates away, network failure, or server error), only metadata parts like `data-chat-title` and `step-start` are saved to the database, but no actual text content. This results in a blank assistant message with no visible content.

## Proposed Changes

### Component Changes

---

#### [MODIFY] [message.tsx](file:///home/hilton/Documents/intellisync/components/message.tsx)

1. **Add `isIncompleteMessage` helper function** (before `PurePreviewMessage`)
   - Checks if an assistant message has parts but no renderable content
   - Filters out metadata-only parts: `data-chat-title`, `step-start`, `reasoning` (if empty)
   - Returns `true` if no text, tool, or document parts exist

2. **Add `IncompleteMessageBanner` inline component**
   - Displays when `isIncompleteMessage` returns `true` AND `isLoading` is `false`
   - Shows a subtle banner with:
     - Info icon
     - Message: "This response was interrupted and could not be completed."
     - "Regenerate" button that calls the `regenerate` function

3. **Integrate banner into message rendering**
   - Add check after parts.map() to render the banner when applicable

---

## Verification Plan

### Automated Tests

**Note**: The existing e2e tests in `tests/e2e/chat.test.ts` test basic chat functionality but do not cover interrupted stream scenarios. Adding an automated test would require mocking the stream interruption which is complex.

### Manual Verification

1. **Build verification**

   ```bash
   npm run build
   ```

2. **Visual verification** - User to manually trigger an incomplete message:
   - Start a new chat
   - Send a message and immediately navigate away or close the browser while the response is streaming
   - Return to the chat and verify the incomplete message banner is displayed
   - Click "Regenerate" and verify a new response is generated

3. **Existing message verification**
   - Navigate to `/chat/0f18690f-a33d-4983-abb4-d1c61bb947c5` (the known blank chat)
   - Verify the incomplete message banner appears instead of a blank space
   - Verify the "Regenerate" button works
