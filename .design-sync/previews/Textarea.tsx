import { Textarea } from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "var(--color-bg-base)",
      padding: 24,
      borderRadius: 12,
      maxWidth: 420,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}
  >
    {children}
  </div>
);

export const Basic = () => (
  <Frame>
    <Textarea
      label="Draft your post"
      rows={4}
      defaultValue={
        "The best growth advice I ignored for years:\n\nStop trying to go viral. Build one reader at a time."
      }
    />
  </Frame>
);

export const WithHint = () => (
  <Frame>
    <Textarea
      label="Reply"
      hint="Keep it under 280 characters"
      rows={3}
      placeholder="Write a thoughtful reply…"
    />
  </Frame>
);

export const WithError = () => (
  <Frame>
    <Textarea
      label="Thread"
      rows={3}
      defaultValue={"1/ ".repeat(1) + "This tweet runs a little long for the hook…"}
      error="Hook exceeds the recommended length"
    />
  </Frame>
);
