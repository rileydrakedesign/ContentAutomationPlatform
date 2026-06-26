import { useState } from "react";
import { SliderDial } from "content-automation";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "var(--color-bg-base)",
      padding: 24,
      borderRadius: 12,
      maxWidth: 420,
      display: "flex",
      flexDirection: "column",
      gap: 24,
    }}
  >
    {children}
  </div>
);

export const VoiceTuning = () => {
  const [formality, setFormality] = useState(35);
  const [energy, setEnergy] = useState(70);
  return (
    <Frame>
      <SliderDial
        label="Tone"
        leftLabel="Casual"
        rightLabel="Formal"
        value={formality}
        onChange={setFormality}
        description="How buttoned-up your posts read"
      />
      <SliderDial
        label="Energy"
        leftLabel="Calm"
        rightLabel="Hyped"
        value={energy}
        onChange={setEnergy}
      />
    </Frame>
  );
};

export const WithValue = () => {
  const [value, setValue] = useState(60);
  return (
    <Frame>
      <SliderDial
        label="Spiciness"
        leftLabel="Safe"
        rightLabel="Contrarian"
        value={value}
        onChange={setValue}
        showValue
        description="How willing your posts are to take a stance"
      />
    </Frame>
  );
};
