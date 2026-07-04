import {
  getPrimaryJapanese,
  type JlptLevel,
  type VocabularySummary,
} from "./vocabulary";

export type VoiceId = "browser" | "voicevox-female" | "voicevox-male";

export type VoiceOption = {
  id: VoiceId;
  name: string;
  type: "browser" | "audio-pack";
  format?: "wav";
};

export type AnswerFeedback = "correct" | "wrong";

export type BackgroundTrack = {
  id: string;
  name: string;
  file: string;
  mood?: string;
  source?: string;
  license?: string;
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
  {
    id: "voicevox-male",
    name: "標準男聲",
    type: "audio-pack",
    format: "wav",
  },
];

const audioCacheName = "japanese-app-audio-v1";
let backgroundAudio: HTMLAudioElement | null = null;
let backgroundAudioUrl = "";

export function getVoice(voiceId: VoiceId) {
  return voiceOptions.find((voice) => voice.id === voiceId) ?? voiceOptions[0];
}

function getAssetUrl(path: string) {
  const basePath = import.meta.env.BASE_URL || "/";
  return `${basePath.replace(/\/?$/, "/")}${path.replace(/^\//, "")}`;
}

export async function loadBackgroundTracks() {
  try {
    const response = await fetch(getAssetUrl("background/manifest.json"), {
      cache: "no-cache",
    });
    if (!response.ok) return [];
    const manifest = (await response.json()) as { tracks?: BackgroundTrack[] };
    return Array.isArray(manifest.tracks) ? manifest.tracks : [];
  } catch {
    return [];
  }
}

export function setBackgroundMusic(
  track: BackgroundTrack | null,
  volume: number,
) {
  if (!track) {
    backgroundAudio?.pause();
    backgroundAudio = null;
    backgroundAudioUrl = "";
    return;
  }

  const nextUrl = getAssetUrl(`background/${track.file}`);
  if (!backgroundAudio || backgroundAudioUrl !== nextUrl) {
    backgroundAudio?.pause();
    backgroundAudio = new Audio(nextUrl);
    backgroundAudio.loop = true;
    backgroundAudio.preload = "auto";
    backgroundAudioUrl = nextUrl;
  }

  backgroundAudio.volume = Math.max(0, Math.min(volume, 100)) / 100;
  void backgroundAudio.play().catch(() => {
    // Mobile browsers may require a direct tap before background music can start.
  });
}

export function setBackgroundMusicVolume(volume: number) {
  if (!backgroundAudio) return;
  backgroundAudio.volume = Math.max(0, Math.min(volume, 100)) / 100;
}

function getWordAudioUrl(voiceId: VoiceId, level: JlptLevel, word: VocabularySummary) {
  return getAssetUrl(`audio/voices/${voiceId}/${level}/${word.id}.wav`);
}

function isPackVoice(voiceId: VoiceId) {
  return getVoice(voiceId).type === "audio-pack";
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

function getAudioContext() {
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playTone(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  startTime: number,
  duration: number,
  gainValue: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

export function playAnswerFeedback(type: AnswerFeedback, volume: number) {
  const context = getAudioContext();
  if (!context) return;

  const output = context.createGain();
  output.gain.value = Math.max(0, Math.min(volume, 100)) / 100;
  output.connect(context.destination);

  const now = context.currentTime;
  if (type === "correct") {
    playTone(context, output, 523.25, now, 0.11, 0.08);
    playTone(context, output, 659.25, now + 0.09, 0.14, 0.07);
  } else {
    playTone(context, output, 220, now, 0.12, 0.055);
    playTone(context, output, 196, now + 0.1, 0.13, 0.045);
  }

  window.setTimeout(() => {
    void context.close();
  }, 420);
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

export async function getMissingAudioWords(
  words: VocabularySummary[],
  level: JlptLevel,
  voiceId: VoiceId,
) {
  if (!isPackVoice(voiceId)) return [];
  if (!("caches" in window)) return words;

  const cache = await caches.open(audioCacheName);
  const matches = await Promise.all(
    words.map((word) => cache.match(getWordAudioUrl(voiceId, level, word))),
  );
  return words.filter((_, index) => !matches[index]);
}

export async function getMissingAudioCount(
  words: VocabularySummary[],
  level: JlptLevel,
  voiceId: VoiceId,
) {
  return (await getMissingAudioWords(words, level, voiceId)).length;
}

export async function downloadAudioPack(
  words: VocabularySummary[],
  level: JlptLevel,
  voiceId: VoiceId,
  onProgress?: (completed: number, total: number) => void,
) {
  if (!isPackVoice(voiceId)) return;

  let completed = 0;
  onProgress?.(completed, words.length);

  for (const word of words) {
    try {
      await fetchAudioWithCache(getWordAudioUrl(voiceId, level, word));
    } catch {
      // A missing file should not block the rest of the pack download.
    } finally {
      completed += 1;
      onProgress?.(completed, words.length);
    }
  }
}

export async function clearDownloadedAudio() {
  if (!("caches" in window)) return false;
  return caches.delete(audioCacheName);
}

export async function clearAllAppCaches() {
  backgroundAudio?.pause();
  backgroundAudio = null;
  backgroundAudioUrl = "";

  if (!("caches" in window)) return 0;

  const cacheNames = await caches.keys();
  const appCacheNames = cacheNames.filter((cacheName) =>
    cacheName.startsWith("japanese-app"),
  );
  await Promise.all(appCacheNames.map((cacheName) => caches.delete(cacheName)));
  return appCacheNames.length;
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
