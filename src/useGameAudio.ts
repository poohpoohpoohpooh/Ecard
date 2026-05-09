import React from "react";

export type BgmType = "opening" | "early" | "late" | "win" | "lose";

const BGM_SOURCES: Record<BgmType, string> = {
  opening: "/assets/audio/bgm-opening.mp3",
  early: "/assets/audio/bgm-turn-early.mp3",
  late: "/assets/audio/bgm-turn-late.mp3",
  win: "/assets/audio/bgm-win.mp3",
  lose: "/assets/audio/bgm-lose.mp3",
};

const SE_SOURCES = {
  cardSelect: "/assets/audio/se-card-select.mp3",
  cardReveal: "/assets/audio/se-card-reveal.mp3",
  button: "/assets/audio/se-button.mp3",
} as const;

type SeType = keyof typeof SE_SOURCES;

class GameAudioManager {
  private bgmMap = new Map<BgmType, HTMLAudioElement>();
  private seMap = new Map<SeType, HTMLAudioElement[]>();
  private currentBgm: BgmType | null = null;
  private unlocked = false;
  private bgmEnabled = true;
  private seEnabled = true;

  constructor() {
    for (const [type, src] of Object.entries(BGM_SOURCES) as Array<[BgmType, string]>) {
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.6;
      this.bgmMap.set(type, audio);
    }

    for (const [type, src] of Object.entries(SE_SOURCES) as Array<[SeType, string]>) {
      this.seMap.set(
        type,
        Array.from({ length: 3 }, () => {
          const audio = new Audio(src);
          audio.preload = "auto";
          audio.volume = 0.8;
          return audio;
        }),
      );
    }
  }

  initAudio() {
    this.unlocked = true;
    if (this.currentBgm && this.bgmEnabled) {
      void this.playCurrentBgm();
    }
  }

  playBgm(type: BgmType) {
    if (this.currentBgm === type) {
      if (this.bgmEnabled && this.unlocked) void this.playCurrentBgm();
      return;
    }

    this.pauseCurrentBgm();
    this.currentBgm = type;

    if (this.bgmEnabled && this.unlocked) {
      void this.playCurrentBgm();
    }
  }

  stopBgm() {
    this.pauseCurrentBgm();
    this.currentBgm = null;
  }

  setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    if (!enabled) {
      this.pauseCurrentBgm();
      return;
    }
    if (this.unlocked) void this.playCurrentBgm();
  }

  setSeEnabled(enabled: boolean) {
    this.seEnabled = enabled;
  }

  playCardSelect() {
    this.playSe("cardSelect");
  }

  playCardReveal() {
    this.playSe("cardReveal");
  }

  playButton() {
    this.playSe("button");
  }

  playWin() {
    this.playBgm("win");
  }

  playLose() {
    this.playBgm("lose");
  }

  dispose() {
    for (const audio of this.bgmMap.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    for (const pool of this.seMap.values()) {
      for (const audio of pool) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }

  private async playCurrentBgm() {
    if (!this.currentBgm) return;
    const audio = this.bgmMap.get(this.currentBgm);
    if (!audio) return;
    try {
      audio.volume = 0.6;
      await audio.play();
    } catch {
      // Browsers can reject play() before a trusted gesture or if decoding fails.
    }
  }

  private pauseCurrentBgm() {
    if (!this.currentBgm) return;
    const audio = this.bgmMap.get(this.currentBgm);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  private playSe(type: SeType) {
    if (!this.seEnabled || !this.unlocked) return;
    const pool = this.seMap.get(type);
    if (!pool) return;
    const audio = pool.find((item) => item.paused || item.ended) ?? pool[0];
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.8;
      void audio.play();
    } catch {
      // Missing or undecodable SE should not break gameplay.
    }
  }
}

export const useGameAudio = () => {
  const managerRef = React.useRef<GameAudioManager | null>(null);
  const [bgmEnabled, setBgmEnabledState] = React.useState(true);
  const [seEnabled, setSeEnabledState] = React.useState(true);

  if (!managerRef.current) managerRef.current = new GameAudioManager();

  React.useEffect(() => {
    return () => managerRef.current?.dispose();
  }, []);

  const setBgmEnabled = React.useCallback((enabled: boolean) => {
    setBgmEnabledState(enabled);
    managerRef.current?.setBgmEnabled(enabled);
  }, []);

  const setSeEnabled = React.useCallback((enabled: boolean) => {
    setSeEnabledState(enabled);
    managerRef.current?.setSeEnabled(enabled);
  }, []);

  return {
    bgmEnabled,
    seEnabled,
    initAudio: () => managerRef.current?.initAudio(),
    playBgm: (type: BgmType) => managerRef.current?.playBgm(type),
    stopBgm: () => managerRef.current?.stopBgm(),
    setBgmEnabled,
    setSeEnabled,
    playCardSelect: () => managerRef.current?.playCardSelect(),
    playCardReveal: () => managerRef.current?.playCardReveal(),
    playButton: () => managerRef.current?.playButton(),
    playWin: () => managerRef.current?.playWin(),
    playLose: () => managerRef.current?.playLose(),
  };
};
