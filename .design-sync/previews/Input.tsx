import { Input } from "content-automation";
import { Search, AtSign } from "lucide-react";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "var(--color-bg-base)",
      padding: 24,
      borderRadius: 12,
      maxWidth: 360,
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
    <Input label="X handle" placeholder="@yourhandle" defaultValue="@compoundwriter" />
  </Frame>
);

export const WithIcon = () => (
  <Frame>
    <Input icon={<Search size={16} />} placeholder="Search your posts" />
    <Input icon={<AtSign size={16} />} iconPosition="left" placeholder="Mention someone" />
  </Frame>
);

export const WithHint = () => (
  <Frame>
    <Input label="Posting cadence" hint="We recommend 1–2 posts per day" defaultValue="2" />
  </Frame>
);

export const WithError = () => (
  <Frame>
    <Input label="API key" defaultValue="sk-live-xxxx" error="This key is invalid or expired" />
  </Frame>
);

export const Disabled = () => (
  <Frame>
    <Input label="Connected account" defaultValue="@compoundwriter" disabled />
  </Frame>
);
