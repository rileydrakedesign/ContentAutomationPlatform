/**
 * Voice confidence — an honest framing of how much of the user's own data backs
 * their tuned voice. Used at cold-start (bootstrap / FirstRunAnalysis) and on the
 * dashboard (Voice Health) so a thin-history account is never over-promised
 * fidelity — the #2 churn risk in the journey research is a thin-history user
 * getting generic output and bouncing.
 */
export type VoiceConfidenceLevel = "thin" | "building" | "good";

export interface VoiceConfidence {
  level: VoiceConfidenceLevel;
  label: string;
  blurb: string;
}

export function voiceConfidence(postsAnalyzed: number): VoiceConfidence {
  if (postsAnalyzed >= 25) {
    return {
      level: "good",
      label: "Strong voice match",
      blurb: `Tuned from ${postsAnalyzed} of your posts — enough signal to sound like you.`,
    };
  }
  if (postsAnalyzed >= 8) {
    return {
      level: "building",
      label: "Voice building",
      blurb: `Tuned from ${postsAnalyzed} posts. Publish or import a few more and your voice gets sharper.`,
    };
  }
  return {
    level: "thin",
    label: "Thin history",
    blurb:
      "Not enough posts yet to confidently match your voice. Import your X analytics CSV or post a few times — early drafts may read generic until then.",
  };
}
