/**
 * Source-specific instructions for voice memo transcripts.
 * Voice memos have unique characteristics that should be preserved.
 */

export const VOICE_MEMO_INSTRUCTIONS = `## VOICE MEMO SOURCE HANDLING

The input is a voice memo transcript. This is raw, spoken thought captured in the moment.

### Preservation Rules
- Preserve natural phrasing where it sounds authentic
- Keep the original thought flow and progression
- Maintain the speaker's voice and personality
- Light cleanup only for readability

### What to Preserve
- Casual language that sounds human
- Natural transitions and thought connections
- Specific details mentioned (numbers, names, tools)
- The emotional undertone (excitement, frustration, curiosity)

### What to Clean Up
- Filler words (um, uh, like) unless they add character
- Repeated false starts
- Incomplete sentences that don't add meaning
- Rambling tangents that dilute the core point

### Extraction Priority
Voice memos often contain:
1. A core insight or realization (this is the gold)
2. Context about what prompted the thought
3. Implications or next steps
4. Tangential ideas (save these, don't include)

Focus on extracting the core insight while maintaining the natural voice.`;
