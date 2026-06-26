import { ScoreDial } from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "var(--color-bg-base)",
      padding: 24,
      borderRadius: 12,
      display: "flex",
      gap: 28,
      alignItems: "center",
    }}
  >
    {children}
  </div>
);

// The Grammarly-style "orb" — a 0–100 readout colored by score band.
export const Bands = () => (
  <Frame>
    <ScoreDial value={92} label="Great" />
    <ScoreDial value={74} label="Good" />
    <ScoreDial value={48} label="Fair" />
    <ScoreDial value={21} label="Weak" />
  </Frame>
);

export const WithErrors = () => (
  <Frame>
    <ScoreDial value={63} label="3 issues" errorCount={3} />
    <ScoreDial value={88} label="Clean" errorCount={0} />
  </Frame>
);

export const Provisional = () => (
  <Frame>
    <ScoreDial value={70} label="Scoring…" provisional checking />
    <ScoreDial value={70} label="Final" />
  </Frame>
);

export const Sizes = () => (
  <Frame>
    <ScoreDial value={81} size={40} />
    <ScoreDial value={81} size={56} />
    <ScoreDial value={81} size={80} label="Score" />
  </Frame>
);
