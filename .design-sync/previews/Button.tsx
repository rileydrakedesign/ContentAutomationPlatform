import { Button } from "content-automation";
import { Send, Sparkles, Trash2 } from "lucide-react";

// Dark app surface — these components are designed for the dark canvas.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12 }}>{children}</div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
);

export const Variants = () => (
  <Frame>
    <Row>
      <Button variant="primary">Publish</Button>
      <Button variant="secondary">Save draft</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="outline">Preview</Button>
      <Button variant="success">Approve</Button>
      <Button variant="danger">Delete</Button>
    </Row>
  </Frame>
);

export const Sizes = () => (
  <Frame>
    <Row>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </Row>
  </Frame>
);

export const WithIcons = () => (
  <Frame>
    <Row>
      <Button icon={<Sparkles size={16} />}>Generate post</Button>
      <Button variant="secondary" icon={<Send size={16} />} iconPosition="right">
        Schedule
      </Button>
      <Button variant="danger" icon={<Trash2 size={16} />}>
        Discard
      </Button>
    </Row>
  </Frame>
);

export const States = () => (
  <Frame>
    <Row>
      <Button loading>Publishing</Button>
      <Button disabled>Disabled</Button>
      <Button glow>Glow</Button>
    </Row>
  </Frame>
);

export const FullWidth = () => (
  <Frame>
    <Button fullWidth icon={<Sparkles size={16} />}>
      Generate 5 post ideas
    </Button>
  </Frame>
);
