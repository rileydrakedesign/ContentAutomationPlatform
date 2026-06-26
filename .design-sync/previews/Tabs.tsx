import { Tabs, TabsList, TabsTrigger, TabsContent } from "content-automation";
import { FileText, Clock, CheckCircle2 } from "lucide-react";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12, minWidth: 380 }}>
    {children}
  </div>
);
const Body = ({ children }: { children: React.ReactNode }) => (
  <p style={{ color: "var(--color-text-secondary)", fontSize: 14, paddingTop: 12 }}>{children}</p>
);

export const Default = () => (
  <Frame>
    <Tabs defaultValue="drafts">
      <TabsList>
        <TabsTrigger value="drafts" icon={<FileText size={14} />} count={4}>
          Drafts
        </TabsTrigger>
        <TabsTrigger value="scheduled" icon={<Clock size={14} />} count={2}>
          Scheduled
        </TabsTrigger>
        <TabsTrigger value="posted" icon={<CheckCircle2 size={14} />}>
          Posted
        </TabsTrigger>
      </TabsList>
      <TabsContent value="drafts">
        <Body>4 drafts waiting for review.</Body>
      </TabsContent>
      <TabsContent value="scheduled">
        <Body>2 posts queued for this week.</Body>
      </TabsContent>
      <TabsContent value="posted">
        <Body>Your published history.</Body>
      </TabsContent>
    </Tabs>
  </Frame>
);

export const Pills = () => (
  <Frame>
    <Tabs defaultValue="voice">
      <TabsList variant="pills">
        <TabsTrigger value="voice">Voice</TabsTrigger>
        <TabsTrigger value="strategy">Strategy</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>
      <TabsContent value="voice">
        <Body>Tune how your posts sound.</Body>
      </TabsContent>
      <TabsContent value="strategy">
        <Body>Your content pillars and cadence.</Body>
      </TabsContent>
      <TabsContent value="insights">
        <Body>What&apos;s working across your account.</Body>
      </TabsContent>
    </Tabs>
  </Frame>
);

export const Underline = () => (
  <Frame>
    <Tabs defaultValue="performance">
      <TabsList variant="underline">
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="patterns">Patterns</TabsTrigger>
      </TabsList>
      <TabsContent value="performance">
        <Body>Engagement over the last 30 days.</Body>
      </TabsContent>
      <TabsContent value="patterns">
        <Body>Recurring patterns in your best posts.</Body>
      </TabsContent>
    </Tabs>
  </Frame>
);
