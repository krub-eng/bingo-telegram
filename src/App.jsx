
import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, Trophy, Users, RefreshCw, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

const BINGO_COLUMNS = {
  B: { min: 1, max: 15, color: 'bg-rose-500' },
  I: { min: 16, max: 30, color: 'bg-amber-500' },
  N: { min: 31, max: 45, color: 'bg-emerald-500' },
  G: { min: 46, max: 60, color: 'bg-sky-500' },
  O: { min: 61, max: 75, color: 'bg-purple-500' }
};

export default function App() {
  const [board, setBoard] = useState([]);
  const [marked, setMarked] = useState({});
  const [drawnBalls, setDrawnBalls] = useState([]);
  const [currentBall, setCurrentBall] = useState(null);
  const [isGameActive, setIsGameActive] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [rivals, setRivals] = useState([
    { name: 'Alex_TG', progress: 0 },
    { name: 'Elena_99', progress: 0 },
    { name: 'CryptoDave', progress: 0 }
  ]);

  const drawTimerRef = useRef(null);

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // Web Audio Synthesizer (No MP3 files needed)
  const playSound = (freq = 440, type = 'sine', duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // AudioContext unavailable
    }
  };

  const triggerHaptic = (style = 'medium') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    }
  };

  // Generate 75-Ball 5x5 Grid
  const generateCard = () => {
    const newBoard = [];
    const keys = ['B', 'I', 'N', 'G', 'O'];

    const cols = keys.map((letter) => {
      const { min, max } = BINGO_COLUMNS[letter];
      const numbers = [];
      while (numbers.length < 5) {
        const rand = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!numbers.includes(rand)) numbers.push(rand);
      }
      return numbers;
    });

    for (let r = 0; r < 5; r++) {
      const row = [];
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) {
          row.push('FREE');
        } else {
          row.push(cols[c][r]);
        }
      }
      newBoard.push(row);
    }

    setBoard(newBoard);
    setMarked({ '2-2': true }); // Center is automatically free
    setDrawnBalls([]);
    setCurrentBall(null);
    setHasWon(false);
    setIsGameActive(false);
    clearInterval(drawTimerRef.current);
  };

  useEffect(() => {
    generateCard();
    return () => clearInterval(drawTimerRef.current);
  }, []);

  // Number Caller Loop
  const startGame = () => {
    generateCard();
    setIsGameActive(true);
    let ballPool = Array.from({ length: 75 }, (_, i) => i + 1);
    let history = [];

    clearInterval(drawTimerRef.current);
    drawTimerRef.current = setInterval(() => {
      if (ballPool.length === 0) {
        clearInterval(drawTimerRef.current);
        return;
      }
      const randIndex = Math.floor(Math.random() * ballPool.length);
      const drawn = ballPool.splice(randIndex, 1)[0];
      history = [drawn, ...history];
      setCurrentBall(drawn);
      setDrawnBalls([...history]);
      playSound(520, 'triangle', 0.2);

      // Simulate rival daubers
      setRivals(prev =>
        prev.map(r => ({
          ...r,
          progress: Math.min(100, r.progress + (Math.random() > 0.6 ? 12 : 0))
        }))
      );
    }, 3500);
  };

  // Check Winning Conditions (Row, Column, Diagonal)
  const checkBingo = (updatedMarks) => {
    // 5 Rows
    for (let r = 0; r < 5; r++) {
      if ([0, 1, 2, 3, 4].every(c => updatedMarks[`${r}-${c}`])) return true;
    }
    // 5 Columns
    for (let c = 0; c < 5; c++) {
      if ([0, 1, 2, 3, 4].every(r => updatedMarks[`${r}-${c}`])) return true;
    }
    // 2 Diagonals
    if ([0, 1, 2, 3, 4].every(i => updatedMarks[`${i}-${i}`])) return true;
    if ([0, 1, 2, 3, 4].every(i => updatedMarks[`${i}-${4 - i}`])) return true;

    return false;
  };

  // Tile Daub Click
  const handleTileClick = (r, c, val) => {
    if (!isGameActive || hasWon) return;
    const key = `${r}-${c}`;

    // Free tile is always marked
    if (val === 'FREE') return;

    // Strict validation: must have been drawn
    if (!drawnBalls.includes(val)) {
      triggerHaptic('error');
      playSound(200, 'sawtooth', 0.2);
      return;
    }

    if (!marked[key]) {
      const nextMarked = { ...marked, [key]: true };
      setMarked(nextMarked);
      triggerHaptic('medium');
      playSound(660, 'sine', 0.15);

      if (checkBingo(nextMarked)) {
        setHasWon(true);
        clearInterval(drawTimerRef.current);
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        playSound(880, 'sine', 0.5);
      }
    }
  };

  const getLetterForNumber = (num) => {
    if (!num) return '';
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none pb-6">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-amber-500 to-rose-500 p-2 rounded-xl text-white shadow-md shadow-rose-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide flex items-center gap-1">
              BINGO CLASH <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </h1>
            <p className="text-xs text-slate-400">Telegram Mini App</p>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 bg-slate-700/60 rounded-xl hover:bg-slate-700 text-slate-300"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-3 flex flex-col gap-3">
        {/* Ball Hopper Display */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[2px] shadow-md shadow-purple-500/20">
              <div className="w-full h-full bg-slate-900 rounded-full flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-400 leading-none">
                  {currentBall ? getLetterForNumber(currentBall) : '•'}
                </span>
                <span className="text-xl font-black text-white leading-tight">
                  {currentBall || '--'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Called Ball</span>
              <p className="text-xs text-slate-300">
                {isGameActive ? 'Daub your card quickly!' : 'Tap Start to begin'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">History</span>
            <div className="flex gap-1 mt-1 justify-end">
              {drawnBalls.slice(1, 4).map((n) => (
                <span
                  key={n}
                  className="w-7 h-7 bg-slate-700/80 rounded-full flex items-center justify-center text-xs font-bold text-slate-200 border border-slate-600/40"
                >
                  {n}
                </span>
              ))}
              {drawnBalls.length <= 1 && <span className="text-xs text-slate-500 italic">None yet</span>}
            </div>
          </div>
        </div>

        {/* 5x5 Bingo Grid */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2.5 shadow-xl">
          {/* Column Header Titles (B I N G O) */}
          <div className="grid grid-cols-5 gap-1.5 mb-1.5 text-center">
            {['B', 'I', 'N', 'G', 'O'].map((char) => (
              <div
                key={char}
                className="py-1.5 bg-slate-900/60 rounded-lg text-sm font-black text-amber-400 tracking-wider shadow-inner"
              >
                {char}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-5 gap-1.5">
            {board.map((row, r) =>
              row.map((val, c) => {
                const isMarked = marked[`${r}-${c}`];
                const isFree = val === 'FREE';

                return (
                  <button
                    key={`${r}-${c}`}
                    disabled={!isGameActive || hasWon}
                    onClick={() => handleTileClick(r, c, val)}
                    className={`aspect-square rounded-xl flex items-center justify-center font-black transition-all transform active:scale-95 border ${
                      isMarked
                        ? 'bg-gradient-to-tr from-amber-500 to-rose-500 border-amber-300 text-white shadow-md shadow-rose-500/30 scale-[0.98]'
                        : 'bg-slate-700/50 hover:bg-slate-700 border-slate-600/40 text-slate-100 hover:border-slate-500'
                    }`}
                  >
                    {isFree ? (
                      <Sparkles className="w-5 h-5 text-amber-200 fill-amber-200" />
                    ) : (
                      <span className="text-base sm:text-lg">{val}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Rival Progress Bar (Simulated Multiplayer Room) */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-bold">
              <Users className="w-3.5 h-3.5" /> Room Players
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">● Live Room</span>
          </div>
          <div className="space-y-1.5">
            {rivals.map((rival) => (
              <div key={rival.name} className="flex items-center gap-2 text-xs">
                <span className="w-20 truncate text-slate-300 font-medium">{rival.name}</span>
                <div className="flex-1 bg-slate-700/50 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${rival.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Victory Notification */}
        {hasWon && (
          <div className="bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 border border-amber-500/40 rounded-xl p-3 text-center animate-bounce">
            <h2 className="text-lg font-black text-amber-300 tracking-wider">🎉 BINGO! YOU WON! 🎉</h2>
            <p className="text-xs text-slate-300 mt-0.5">Your pattern was completed and verified!</p>
          </div>
        )}

        {/* Control Button */}
        <div className="mt-auto pt-2">
          {!isGameActive ? (
            <button
              onClick={startGame}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-white" />
              START GAME
            </button>
          ) : (
            <button
              onClick={startGame}
              className="w-full py-3 bg-slate-700/80 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl border border-slate-600/50 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset / New Card
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
