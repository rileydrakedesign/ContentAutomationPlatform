import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: "var(--color-bg-base)", padding: 24, borderRadius: 12, maxWidth: 420 }}>
    {children}
  </div>
);

export const Basic = () => (
  <Frame>
    <Card>
      <CardHeader action={<Badge variant="primary">Scheduled</Badge>}>
        <CardTitle>Morning thread</CardTitle>
        <CardDescription>Goes out tomorrow at 9:00 AM</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
          Most people optimize their tweets for likes. The ones who compound optimize for replies — that&apos;s
          where the algorithm actually rewards you.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Edit</Button>
        <Button size="sm" variant="ghost">
          Preview
        </Button>
      </CardFooter>
    </Card>
  </Frame>
);

export const Selected = () => (
  <Frame>
    <Card selected glow>
      <CardContent>
        <CardTitle>Voice profile</CardTitle>
        <CardDescription>Selected as your default writing voice</CardDescription>
      </CardContent>
    </Card>
  </Frame>
);

export const Glass = () => (
  <Frame>
    <Card glass>
      <CardContent>
        <CardTitle>Glass surface</CardTitle>
        <CardDescription>Translucent panel over the dark canvas</CardDescription>
      </CardContent>
    </Card>
  </Frame>
);

export const Hoverable = () => (
  <Frame>
    <Card hover>
      <CardContent>
        <CardTitle>Boost opportunity</CardTitle>
        <CardDescription>Hover state — used for clickable list cards</CardDescription>
      </CardContent>
    </Card>
  </Frame>
);
