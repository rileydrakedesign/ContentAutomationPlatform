import { StatusBadge } from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12 }}>{children}</div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
);

// Maps a content lifecycle status string to a dotted, color-coded badge.
export const PostLifecycle = () => (
  <Frame>
    <Row>
      <StatusBadge status="DRAFT" />
      <StatusBadge status="GENERATED" />
      <StatusBadge status="APPROVED" />
      <StatusBadge status="SCHEDULED" />
      <StatusBadge status="POSTED" />
      <StatusBadge status="REJECTED" />
    </Row>
  </Frame>
);

export const StrategyState = () => (
  <Frame>
    <Row>
      <StatusBadge status="active" />
      <StatusBadge status="paused" />
      <StatusBadge status="inbox" />
      <StatusBadge status="triaged" />
    </Row>
  </Frame>
);
