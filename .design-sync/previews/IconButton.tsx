import { IconButton } from "content-automation";
import { Heart, Repeat2, Bookmark, MoreHorizontal, Pencil } from "lucide-react";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12 }}>{children}</div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>
);

export const TweetActions = () => (
  <Frame>
    <Row>
      <IconButton aria-label="Like" icon={<Heart size={18} />} />
      <IconButton aria-label="Repost" icon={<Repeat2 size={18} />} />
      <IconButton aria-label="Bookmark" icon={<Bookmark size={18} />} />
      <IconButton aria-label="More" icon={<MoreHorizontal size={18} />} />
    </Row>
  </Frame>
);

export const Variants = () => (
  <Frame>
    <Row>
      <IconButton aria-label="Edit" variant="primary" icon={<Pencil size={18} />} />
      <IconButton aria-label="Edit" variant="secondary" icon={<Pencil size={18} />} />
      <IconButton aria-label="Edit" variant="ghost" icon={<Pencil size={18} />} />
      <IconButton aria-label="Edit" variant="danger" icon={<Pencil size={18} />} />
    </Row>
  </Frame>
);
