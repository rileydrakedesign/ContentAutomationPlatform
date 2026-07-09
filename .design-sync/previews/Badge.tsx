import { Badge } from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12 }}>{children}</div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
);

export const Variants = () => (
  <Frame>
    <Row>
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Posted</Badge>
      <Badge variant="warning">Draft</Badge>
      <Badge variant="danger">Rejected</Badge>
      <Badge variant="accent">Inspiration</Badge>
      <Badge variant="outline">Outline</Badge>
    </Row>
  </Frame>
);

export const WithDot = () => (
  <Frame>
    <Row>
      <Badge variant="success" dot>
        Active
      </Badge>
      <Badge variant="warning" dot>
        Pending
      </Badge>
      <Badge variant="primary" dot>
        Scheduled
      </Badge>
    </Row>
  </Frame>
);

export const Sizes = () => (
  <Frame>
    <Row>
      <Badge size="sm" variant="primary">
        Small
      </Badge>
      <Badge size="md" variant="primary">
        Medium
      </Badge>
    </Row>
  </Frame>
);
