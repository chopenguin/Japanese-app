import {
  getPrimaryJapanese,
  type JlptLevel,
  type VocabularySummary,
} from "./vocabulary";

export type VoiceId = "browser" | "voicevox-female";

export type VoiceOption = {
  id: VoiceId;
  name: string;
  type: "browser" | "audio-pack";
  format?: "wav";
};

export const voiceOptions: VoiceOption[] = [
  {
    id: "browser",
    name: "系統語音",
    type: "browser",
  },
  {
    id: "voicevox-female",
    name: "標準女聲",
    type: "audio-pack",
    format: "wav",
  },
];

const audioCacheName = "japanese-app-audio-v1";

export function getVoice(voiceId: VoiceId) {
  return voiceOptions.find((voice) => voice.id === voiceId) ?? voiceOptions[0];
}

function getAssetUrl(path: string) {
  const basePath = import.meta.env.BASE_URL || "/";
  return `${basePath.replace(/\/?$/, "/")}${path.replace(/^\//, "")}`;
}

function getWordAudioUrl(voiceId: VoiceId, level: JlptLevel, word: VocabularySummary) {
  return getAssetUrl(`audio/voices/${voiceId}/${level}/${word.id}.wav`);
}

function speakWithBrowser(word: VocabularySummary, volume: number) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.kana || getPrimaryJapanese(word));
  utterance.lang = "ja-JP";
  utterance.rate = 0.86;
  utterance.volume = volume / 100;
  window.speechSynthesis.speak(utterance);
}

async function fetchAudioWithCache(url: string) {
  if (!("caches" in window)) {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.blob();
  }

  const cache = await caches.open(audioCacheName);
  const cached = await cache.match(url);
  if (cached) return cached.blob();

  const response = await fetch(url);
  if (!response.ok) return null;

  await cache.put(url, response.clone());
  return response.blob();
}

export async function preloadWordAudio(
  word: VocabularySummary,
  level: JlptLevel,
  voiceId: VoiceId,
) {
  const voice = getVoice(voiceId);
  if (voice.type !== "audio-pack") return;

  try {
    await fetchAudioWithCache(getWordAudioUrl(voiceId, level, word));
  } catch {
    // Missing voice-pack files should not block study flow.
  }
}

export async function preloadStageAudio(
  words: VocabularySummary[],
  level: JlptLevel,
  voiceId: VoiceId,
) {
  await Promise.all(words.map((word) => preloadWordAudio(word, level, voiceId)));
}

export async function playWordAudio(
  word: VocabularySummary,
  level: JlptLevel,
  voiceId: VoiceId,
  volume: number,
) {
  const voice = getVoice(voiceId);

  if (voice.type === "browser") {
    speakWithBrowser(word, volume);
    return;
  }

  try {
    const blob = await fetchAudioWithCache(getWordAudioUrl(voiceId, level, word));
    if (!blob) {
      speakWithBrowser(word, volume);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.volume = volume / 100;
    audio.addEventListener("ended", () => URL.revokeObjectURL(objectUrl), {
      once: true,
    });
    await audio.play();
  } catch {
    speakWithBrowser(word, volume);
  }
}
