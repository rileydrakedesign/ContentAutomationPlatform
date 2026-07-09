import { TypeBadge } from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12 }}>{children}</div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
);

// Maps a content type string to a labeled badge.
export const ContentTypes = () => (
  <Frame>
    <Row>
      <TypeBadge type="X_POST" />
      <TypeBadge type="X_THREAD" />
      <TypeBadge type="NEWS" />
      <TypeBadge type="INSPIRATION" />
      <TypeBadge type="my_post" />
    </Row>
  </Frame>
);
