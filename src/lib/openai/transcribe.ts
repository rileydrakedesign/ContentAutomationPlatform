import { openai } from "./client";

export async function transcribeAudio(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
  const file = new File([audioBuffer], fileName, { type: "audio/mpeg" });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "text",
  });

  return transcription;
}
