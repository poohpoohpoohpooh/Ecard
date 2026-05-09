import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { BgmType, useGameAudio } from "./useGameAudio";

const ASSETS = {
  cards: {
    emperor: "/assets/clean/koutei.png",
    citizen: "/assets/clean/shimin.png",
    slave: "/assets/clean/dorei.png",
    back: "/assets/clean/haimen.png",
  },
  background: "/assets/haikei3.png",
  player: {
    normal: "/assets/Player0.png",
    tense: "/assets/Player1.png",
    win: "/assets/PlayerWin.png",
    lose: "/assets/PlayerLose.png",
  },
  enemy: {
    normal: "/assets/enemy0.png",
    tense: "/assets/enemy1.png",
    win: "/assets/enemyWin.png",
    lose: "/assets/enemyLose.png",
  },
  screens: {
    start: "/assets/start.png",
    opening: "/assets/op.png",
    win: "/assets/youwin.png",
    lose: "/assets/lose.png",
  },
} as const;

type Card = "emperor" | "citizen" | "slave";
type Side = "emperor" | "slave";
type Result = "player" | "cpu" | "draw";
type Phase = "select" | "set" | "revealing" | "revealed" | "gameOver";
type Scene = "start" | "opening" | "game" | "ending";
type PressedAction = "battle" | "next";

type PlayedCard = {
  id: string;
  type: Card;
};

const TOTAL_ROUNDS = 12;

const CARD_LABEL: Record<Card, string> = {
  emperor: "emperor",
  citizen: "citizen",
  slave: "slave",
};

const getPlayerSideForRound = (roundNumber: number): Side =>
  Math.floor((roundNumber - 1) / 3) % 2 === 0 ? "emperor" : "slave";

const makeDeck = (side: Side): PlayedCard[] => {
  const special = side === "emperor" ? "emperor" : "slave";
  return [
    { id: `${side}-special`, type: special },
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `${side}-citizen-${index}`,
      type: "citizen" as const,
    })),
  ];
};

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const decideWinner = (playerCard: Card, cpuCard: Card): Result => {
  if (playerCard === cpuCard) return "draw";
  if (playerCard === "emperor" && cpuCard === "citizen") return "player";
  if (playerCard === "citizen" && cpuCard === "slave") return "player";
  if (playerCard === "slave" && cpuCard === "emperor") return "player";
  return "cpu";
};

const chooseCpuCard = (cards: PlayedCard[], turn: number): PlayedCard => {
  const citizenCards = cards.filter((card) => card.type === "citizen");
  const specialCards = cards.filter((card) => card.type !== "citizen");
  const preferCitizen = turn <= 3 ? 0.76 : 0.28;
  const pool =
    Math.random() < preferCitizen
      ? citizenCards.length > 0
        ? citizenCards
        : cards
      : specialCards.length > 0
        ? specialCards
        : cards;
  return pool[Math.floor(Math.random() * pool.length)];
};

function App() {
  const audio = useGameAudio();
  const [scene, setScene] = React.useState<Scene>("start");
  const [endingResult, setEndingResult] = React.useState<"player" | "cpu" | null>(null);
  const [round, setRound] = React.useState(1);
  const [roundResults, setRoundResults] = React.useState<Result[]>([]);
  const [playerSide, setPlayerSide] = React.useState<Side>(() => getPlayerSideForRound(1));
  const [playerCards, setPlayerCards] = React.useState(() => shuffle(makeDeck("emperor")));
  const [cpuCards, setCpuCards] = React.useState(() => shuffle(makeDeck("slave")));
  const [usedPlayerIds, setUsedPlayerIds] = React.useState<string[]>([]);
  const [usedCpuIds, setUsedCpuIds] = React.useState<string[]>([]);
  const [pendingPlayer, setPendingPlayer] = React.useState<PlayedCard | null>(null);
  const [pendingCpu, setPendingCpu] = React.useState<PlayedCard | null>(null);
  const [playedPlayer, setPlayedPlayer] = React.useState<PlayedCard | null>(null);
  const [playedCpu, setPlayedCpu] = React.useState<PlayedCard | null>(null);
  const [phase, setPhase] = React.useState<Phase>("select");
  const [lastResult, setLastResult] = React.useState<Result | null>(null);
  const [setAnimationKey, setSetAnimationKey] = React.useState(0);
  const [pressedAction, setPressedAction] = React.useState<PressedAction | null>(null);
  const [isAdvancing, setIsAdvancing] = React.useState(false);
  const buttonEffectTimerRef = React.useRef<number | null>(null);

  const turn = Math.min(usedPlayerIds.length + 1, 5);
  const isFinished = phase === "gameOver";
  const hasSetCards = phase === "set" || phase === "revealing";
  const playerWins = roundResults.filter((result) => result === "player").length;
  const cpuWins = roundResults.filter((result) => result === "cpu").length;

  const bgmType: BgmType =
    scene === "opening"
      ? "opening"
      : scene === "start"
        ? "opening"
      : scene === "ending"
        ? endingResult === "player"
          ? "win"
          : "lose"
        : turn >= 4
          ? "late"
          : "early";

  React.useEffect(() => {
    audio.playBgm(bgmType);
  }, [audio, bgmType]);

  React.useEffect(() => {
    return () => {
      if (buttonEffectTimerRef.current !== null) {
        window.clearTimeout(buttonEffectTimerRef.current);
      }
    };
  }, []);

  const triggerButtonEffect = (action: PressedAction) => {
    if (buttonEffectTimerRef.current !== null) {
      window.clearTimeout(buttonEffectTimerRef.current);
    }
    setPressedAction(null);
    window.setTimeout(() => setPressedAction(action), 0);
    buttonEffectTimerRef.current = window.setTimeout(() => {
      setPressedAction(null);
      buttonEffectTimerRef.current = null;
    }, 420);
  };

  const playerIcon =
    lastResult === "player"
      ? ASSETS.player.win
      : lastResult === "cpu"
        ? ASSETS.player.lose
        : turn >= 4
          ? ASSETS.player.tense
          : ASSETS.player.normal;

  const cpuIcon =
    lastResult === "player"
      ? ASSETS.enemy.lose
      : lastResult === "cpu"
        ? ASSETS.enemy.win
        : turn >= 4
          ? ASSETS.enemy.tense
          : ASSETS.enemy.normal;

  const startRound = (nextRound: number) => {
    const nextPlayerSide = getPlayerSideForRound(nextRound);
    setRound(nextRound);
    setPlayerSide(nextPlayerSide);
    setPlayerCards(shuffle(makeDeck(nextPlayerSide)));
    setCpuCards(shuffle(makeDeck(nextPlayerSide === "emperor" ? "slave" : "emperor")));
    setUsedPlayerIds([]);
    setUsedCpuIds([]);
    setPendingPlayer(null);
    setPendingCpu(null);
    setPlayedPlayer(null);
    setPlayedCpu(null);
    setLastResult(null);
    setPhase("select");
  };

  const resetGame = () => {
    setRoundResults([]);
    setEndingResult(null);
    startRound(1);
  };

  const startGame = () => {
    audio.initAudio();
    audio.playButton();
    resetGame();
    setScene("game");
  };

  const showOpening = () => {
    audio.initAudio();
    audio.playButton();
    setScene("opening");
  };

  const backToOpening = () => {
    audio.initAudio();
    audio.playButton();
    resetGame();
    setScene("opening");
  };

  const handleSelectCard = (card: PlayedCard) => {
    if ((phase !== "select" && phase !== "set") || usedPlayerIds.includes(card.id)) return;
    const cpuCard = chooseCpuCard(
      cpuCards.filter((item) => !usedCpuIds.includes(item.id)),
      turn,
    );
    setPendingPlayer(card);
    setPendingCpu(cpuCard);
    setPlayedPlayer(null);
    setPlayedCpu(null);
    setSetAnimationKey((key) => key + 1);
    audio.playCardSelect();
    setPhase("set");
  };

  const handleBattle = () => {
    if (!pendingPlayer || !pendingCpu || phase !== "set") return;

    triggerButtonEffect("battle");
    audio.playButton();
    audio.playCardReveal();
    setPhase("revealing");
    window.setTimeout(() => {
      const result = decideWinner(pendingPlayer.type, pendingCpu.type);
      const nextResults = [...roundResults, result];
      const nextPlayerWins = nextResults.filter((item) => item === "player").length;
      const nextCpuWins = nextResults.filter((item) => item === "cpu").length;
      const isFinalRound = nextResults.length >= TOTAL_ROUNDS;

      setPlayedPlayer(pendingPlayer);
      setPlayedCpu(pendingCpu);
      setUsedPlayerIds((ids) => [...ids, pendingPlayer.id]);
      setUsedCpuIds((ids) => [...ids, pendingCpu.id]);
      setPendingPlayer(null);
      setPendingCpu(null);
      setLastResult(result === "draw" ? null : result);

      if (result === "draw") {
        setPhase("select");
        return;
      }

      setRoundResults(nextResults);
      setPhase(isFinalRound ? "gameOver" : "revealed");

      if (isFinalRound) {
        window.setTimeout(() => {
          setEndingResult(nextPlayerWins > nextCpuWins ? "player" : "cpu");
          if (nextPlayerWins > nextCpuWins) audio.playWin();
          else audio.playLose();
          setScene("ending");
        }, 1100);
      }
    }, 500);
  };

  const handleNext = () => {
    if (isAdvancing) return;

    setIsAdvancing(true);
    triggerButtonEffect("next");
    audio.playButton();
    window.setTimeout(() => {
      if (isFinished) {
        startGame();
      } else {
        startRound(round + 1);
      }
      setIsAdvancing(false);
    }, 180);
  };

  return (
    <main className="screen">
      {scene === "opening" && (
        <section className="splash-screen opening-screen">
          <img src={ASSETS.screens.opening} alt="Opening" />
          <button className="screen-hotspot" onClick={startGame} aria-label="Start game" />
        </section>
      )}

      {scene === "start" && (
        <section className="splash-screen start-screen">
          <img src={ASSETS.screens.start} alt="Start" />
          <button className="screen-hotspot" onClick={showOpening} aria-label="Go to opening" />
        </section>
      )}

      {scene === "ending" && endingResult && (
        <section className={`splash-screen ending-screen ${endingResult === "player" ? "ending-win" : "ending-lose"}`}>
          <img src={endingResult === "player" ? ASSETS.screens.win : ASSETS.screens.lose} alt="Ending" />
          <button className="screen-hotspot" onClick={backToOpening} aria-label="Back to opening" />
        </section>
      )}

      {scene === "game" && (
        <section
          className={`game-stage ${lastResult === "player" ? "win-flash" : ""} ${
            lastResult === "cpu" ? "lose-shake" : ""
          } ${pressedAction === "battle" ? "battle-button-pressed" : ""} ${
            pressedAction === "next" ? "next-button-pressed" : ""
          }`}
          aria-label="E-card game"
        >
          <div className={`avatar-slot enemy-avatar ${cpuIcon.includes("Lose") ? "meltdown" : ""}`}>
            <div className="avatar">
              <img src={cpuIcon} alt="CPU" />
            </div>
          </div>
          <div className={`avatar-slot player-avatar ${playerIcon.includes("Lose") ? "meltdown" : ""}`}>
            <div className="avatar">
              <img src={playerIcon} alt="Player" />
            </div>
          </div>

          <div className="round-board" aria-label="Round results">
            <span className="round-board-title">
              {round}/{TOTAL_ROUNDS}
            </span>
            <div className="round-marks">
              {Array.from({ length: TOTAL_ROUNDS }, (_, index) => {
                const result = roundResults[index];
                const label = result === "player" ? "〇" : result === "cpu" ? "×" : "";
                return (
                  <span
                    key={index}
                    className={`round-mark ${result === "player" ? "win" : ""} ${result === "cpu" ? "loss" : ""} ${
                      index + 1 === round && !isFinished ? "current" : ""
                    }`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="audio-controls" aria-label="Audio controls">
            <button
              className={audio.bgmEnabled ? "enabled" : ""}
              onClick={() => {
                audio.playButton();
                audio.setBgmEnabled(!audio.bgmEnabled);
              }}
              aria-label="Toggle BGM"
            >
              BGM
            </button>
            <button
              className={audio.seEnabled ? "enabled" : ""}
              onClick={() => {
                audio.playButton();
                audio.setSeEnabled(!audio.seEnabled);
              }}
              aria-label="Toggle sound effects"
            >
              SE
            </button>
          </div>

          <div className="cpu-hand" aria-label="CPU cards">
            {Array.from({ length: 5 }, (_, index) => (
              <img
                key={index}
                className={`card hand-back ${index < usedCpuIds.length ? "used" : ""}`}
                src={ASSETS.cards.back}
                alt="CPU card"
              />
            ))}
          </div>

          <div className="battle-area" aria-live="polite">
            {hasSetCards && (
              <img
                key={`cpu-set-${setAnimationKey}`}
                className="card battle-card cpu-card is-back"
                src={ASSETS.cards.back}
                alt="CPU set card"
              />
            )}
            {hasSetCards && (
              <img
                key={`player-set-${setAnimationKey}`}
                className="card battle-card player-card is-back"
                src={ASSETS.cards.back}
                alt="Player set card"
              />
            )}
            {playedCpu && (
              <img
                className="card battle-card cpu-card is-face"
                src={ASSETS.cards[playedCpu.type]}
                alt="CPU revealed card"
              />
            )}
            {playedPlayer && (
              <img
                className="card battle-card player-card is-face"
                src={ASSETS.cards[playedPlayer.type]}
                alt="Player revealed card"
              />
            )}
          </div>

          <div className="player-hand" aria-label="Player cards">
            {playerCards.map((card) => (
              <button
                key={card.id}
                className={`hand-card ${pendingPlayer?.id === card.id ? "selected" : ""} ${
                  usedPlayerIds.includes(card.id) ? "spent" : ""
                }`}
                onClick={() => handleSelectCard(card)}
                disabled={(phase !== "select" && phase !== "set") || usedPlayerIds.includes(card.id)}
                aria-label={`Select ${CARD_LABEL[card.type]}`}
              >
                <img className="card" src={ASSETS.cards[card.type]} alt={CARD_LABEL[card.type]} />
              </button>
            ))}
          </div>

          {(phase === "select" || phase === "set" || phase === "revealing") && (
            <button
              className="hotspot battle-hotspot"
              onClick={handleBattle}
              disabled={phase !== "set"}
              aria-label="Battle"
            />
          )}
          {(phase === "revealed" || phase === "gameOver") && (
            <button
              className="hotspot next-hotspot"
              onClick={handleNext}
              disabled={isAdvancing}
              aria-label={isFinished ? "Replay" : "Next round"}
            />
          )}
        </section>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
