import React, { useState, useEffect, useRef } from 'react';
import { generateMystery, getHint } from './services/geminiService';
import { authService } from './services/authService';
import { MysteryCase, GameState, Difficulty, User, ClueType } from './types';
import { Button, Card, Badge, Modal, ProgressBar } from './components/UI';
import { Auth } from './components/Auth';
import { PuzzleGame } from './components/PuzzleGame';
import { Celebration } from './components/Celebration';
import { 
  Search, 
  BrainCircuit, 
  MapPin, 
  Eye, 
  MessageSquare, 
  Archive, 
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  X,
  LogOut,
  Trophy,
  Star,
  Lock,
  Unlock,
  User as UserIcon,
  Fingerprint,
  Pin
} from 'lucide-react';

// Fun loading messages
const LOADING_MESSAGES = [
  "Dusting for fingerprints on a donut...",
  "Interrogating the coffee machine...",
  "Chasing a very suspicious squirrel...",
  "Reading 'Detective Work for Dummies'...",
  "Looking for my magnifying glass...",
  "Connecting red strings on a corkboard...",
  "Bribing a witness with cat treats..."
];

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);

  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.Auth);
  const [mystery, setMystery] = useState<MysteryCase | null>(null);
  const [revealedClues, setRevealedClues] = useState<number[]>([]);
  const [lockedClues, setLockedClues] = useState<number[]>([]); // IDs of clues that require a puzzle
  const [activePuzzleClueId, setActivePuzzleClueId] = useState<number | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);
  
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.Easy);
  const [hint, setHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Loading Fluff
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  
  // Level Up State
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  const hasApiKey = !!process.env.API_KEY;

  // Initial Auth Check
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setGameState(GameState.Idle);
    } else {
      setGameState(GameState.Auth);
    }

    if (!hasApiKey) {
        setError("Missing API Key. Please provide a valid API Key in the environment.");
    }
  }, [hasApiKey]);

  // Cycle loading messages
  useEffect(() => {
    let interval: any;
    if (gameState === GameState.Loading) {
        interval = setInterval(() => {
            setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
        }, 2000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setGameState(GameState.Idle);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setGameState(GameState.Auth);
    setMystery(null);
  };

  const startGame = async (difficulty: Difficulty) => {
    setGameState(GameState.Loading);
    setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    setSelectedDifficulty(difficulty);
    setRevealedClues([]);
    setLockedClues([]);
    setHint(null);
    setSelectedOption(null);
    setError(null);
    setIsCelebrating(false);

    try {
      const newCase = await generateMystery(difficulty);
      
      // Determine which clues are locked (Mini-game required)
      // We prioritize Physical Objects and Testimony for locking to simulate "Analysis"
      const locks: number[] = [];
      newCase.clues.forEach(clue => {
        const isLockable = clue.type === ClueType.Physical || clue.type === ClueType.Testimony;
        // ~40% chance to lock a lockable clue, or slightly higher for Hard difficulty
        const chance = difficulty === Difficulty.Hard ? 0.6 : 0.4;
        if (isLockable && Math.random() < chance) {
          locks.push(clue.id);
        }
      });
      
      setLockedClues(locks);
      setMystery(newCase);
      setGameState(GameState.Playing);
    } catch (err) {
      console.error(err);
      setError("Failed to contact headquarters. The AI service might be busy or configured incorrectly.");
      setGameState(GameState.Idle);
    }
  };

  const handleClueClick = (clueId: number) => {
    if (lockedClues.includes(clueId)) {
        setActivePuzzleClueId(clueId);
    } else {
        revealClue(clueId);
    }
  };

  const handlePuzzleSuccess = () => {
    if (activePuzzleClueId !== null) {
        setLockedClues(prev => prev.filter(id => id !== activePuzzleClueId));
        revealClue(activePuzzleClueId);
        setActivePuzzleClueId(null);
    }
  };

  const revealClue = (clueId: number) => {
    if (!revealedClues.includes(clueId)) {
      setRevealedClues(prev => [...prev, clueId]);
    }
  };

  const fetchHint = async () => {
    if (!mystery) return;
    setIsHintLoading(true);
    try {
      const hintText = await getHint(mystery, revealedClues);
      setHint(hintText);
    } catch (e) {
      setHint("The connection is fuzzy. I can't get a hint right now.");
    } finally {
      setIsHintLoading(false);
    }
  };

  const submitSolution = async () => {
    if (!selectedOption || !mystery) return;
    
    if (selectedOption === mystery.correctOptionId) {
      // Close solving modal temporarily
      setGameState(GameState.Playing); 
      // Trigger Celebration
      setIsCelebrating(true);

      // We calculate XP now but update state after celebration
      let xp = 0;
      switch (mystery.difficulty) {
        case Difficulty.Easy: xp = 50; break;
        case Difficulty.Medium: xp = 100; break;
        case Difficulty.Hard: xp = 200; break;
      }
      setXpGained(xp);

      // Save progress in background
      try {
        const result = await authService.addXp(xp);
        setUser(result.user);
        if (result.leveledUp) {
            // We'll show this after the celebration modal
            setTimeout(() => setShowLevelUp(true), 3500); 
        }
      } catch (e) {
        console.error("Failed to save progress", e);
      }

    } else {
      setGameState(GameState.Failure);
    }
  };

  const handleCelebrationComplete = () => {
    setIsCelebrating(false);
    setGameState(GameState.Success);
  };

  const resetGame = () => {
    setGameState(GameState.Idle);
    setMystery(null);
  };

  // Scroll to bottom when new clues revealed
  useEffect(() => {
    if (gameState === GameState.Playing && scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [revealedClues.length, gameState]);


  if (gameState === GameState.Auth) {
    return <Auth onLogin={handleLogin} />;
  }

  if (error && !mystery && gameState !== GameState.Idle) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <Card className="max-w-md w-full border-red-900/50 bg-red-950/10">
                <div className="flex flex-col items-center text-center gap-4">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <h2 className="text-xl font-bold text-red-400">System Error</h2>
                    <p className="text-slate-400">{error}</p>
                    <Button variant="secondary" onClick={() => setGameState(GameState.Idle)}>Back to Dashboard</Button>
                </div>
            </Card>
        </div>
      )
  }

  return (
    <div className="min-h-screen pb-20 font-sans selection:bg-amber-500/30">
      
      {/* CELEBRATION OVERLAY */}
      {isCelebrating && <Celebration onComplete={handleCelebrationComplete} />}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shadow-2xl">
        <div className="caution-tape h-1.5 w-full absolute bottom-0 left-0 opacity-80"></div>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2 group cursor-default">
              <div className="p-2 bg-slate-900 rounded-full border border-slate-700 shadow-inner group-hover:border-amber-500/50 transition-colors">
                 <Fingerprint className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex flex-col">
                  <h1 className="text-xl font-serif font-bold tracking-wide text-slate-100 leading-none">
                    DETECTIVE <span className="text-amber-600">LOGIC</span>
                  </h1>
                  <span className="text-[10px] text-slate-500 tracking-[0.2em] uppercase">Investigative Unit</span>
              </div>
            </div>
            {/* Mobile Logout */}
            <button onClick={handleLogout} className="sm:hidden text-slate-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* User Stats */}
          {user && (
             <div className="flex items-center gap-6 w-full sm:w-auto bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-800 shadow-inner">
                <div className="flex items-center gap-3 flex-1 sm:flex-none">
                  <div className="relative">
                    <div className="w-9 h-9 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center font-bold text-slate-950 shadow-lg ring-2 ring-slate-950">
                        {user.level}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full p-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <ProgressBar current={user.currentXP} max={user.xpToNextLevel} label="Rank Progress" />
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="hidden sm:block text-slate-500 hover:text-slate-300 transition-colors hover:rotate-90 duration-300"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
             </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        
        {/* IDLE STATE - Difficulty Selection */}
        {gameState === GameState.Idle && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            <div className="text-center space-y-6 max-w-lg relative">
               {/* Decorative background glow */}
              <div className="absolute -inset-10 bg-amber-500/5 blur-3xl rounded-full -z-10"></div>
              
              <div className="inline-block mb-2">
                <div className="bg-slate-900/80 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-medium text-amber-500 flex items-center gap-2 shadow-lg">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Active Session: Detective {user?.username}
                </div>
              </div>
              
              <h2 className="text-5xl font-serif font-bold text-slate-100 drop-shadow-lg">
                New Case <br/><span className="text-slate-500 text-3xl">Assignment</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                The department has a fresh stack of mysteries. Choose your difficulty level to begin the investigation.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl">
              {(Object.values(Difficulty) as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => startGame(diff)}
                  className="group relative p-6 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-xl hover:border-amber-500/50 transition-all duration-300 text-left hover:-translate-y-2 shadow-lg hover:shadow-amber-900/20 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Search className="w-16 h-16 text-amber-500" />
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-2xl font-serif font-bold text-slate-100 mb-2 group-hover:text-amber-400 transition-colors">{diff}</h3>
                    <div className="h-1 w-12 bg-slate-700 group-hover:bg-amber-500 transition-colors mb-4 rounded-full"></div>
                    <p className="text-sm text-slate-400 group-hover:text-slate-300 mb-6 min-h-[40px]">
                        {diff === Difficulty.Easy ? "Simple deduction. Good for rookies." : 
                        diff === Difficulty.Medium ? "A standard case with a twist." : 
                        "Conspiracies, lies, and red herrings."}
                    </p>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-amber-500/80">
                        <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> XP REWARD</span>
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 group-hover:border-amber-900/50">
                            {diff === Difficulty.Easy ? "50" : diff === Difficulty.Medium ? "100" : "200"}
                        </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {gameState === GameState.Loading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 text-center px-4">
            <div className="relative">
              <div className="w-24 h-24 border-t-4 border-b-4 border-amber-600/50 rounded-full animate-spin duration-[3s]"></div>
              <div className="w-16 h-16 border-r-4 border-l-4 border-slate-600/50 rounded-full animate-spin absolute inset-4 direction-reverse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <BrainCircuit className="w-8 h-8 text-amber-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
                <h3 className="text-2xl font-serif font-bold text-slate-200 tracking-wide">BUILDING CASE FILE</h3>
                <div className="caution-tape h-2 w-48 mx-auto opacity-50 rounded-full"></div>
                <p className="text-slate-500 italic text-sm min-h-[24px] transition-all duration-300">"{loadingMsg}"</p>
            </div>
          </div>
        )}

        {/* PLAYING STATE */}
        {(gameState === GameState.Playing || gameState === GameState.Solving || gameState === GameState.Success || gameState === GameState.Failure) && mystery && (
          <div className="space-y-10 animate-in fade-in duration-500 pb-32">
            
            {/* Case Header */}
            <div className="space-y-6 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between border-b border-slate-800 pb-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 justify-center md:justify-start">
                        <Badge type="warning">OPEN CASE</Badge>
                        <span className="text-slate-600 font-mono text-xs">#{Math.floor(Math.random() * 90000)}</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-serif font-bold text-slate-100 leading-tight">
                        {mystery.title}
                    </h2>
                  </div>
                  <div className="flex flex-col items-center md:items-end gap-1 text-right">
                      <span className="text-xs text-slate-500 uppercase tracking-widest">Difficulty</span>
                      <span className={`font-serif text-xl font-bold ${mystery.difficulty === Difficulty.Hard ? 'text-red-500' : mystery.difficulty === Difficulty.Medium ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {mystery.difficulty}
                      </span>
                  </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-600"></div>
                <h4 className="text-amber-600 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Initial Report
                </h4>
                <p className="text-lg text-slate-300 leading-relaxed font-serif">
                  "{mystery.scenario}"
                </p>
              </div>
            </div>

            {/* Clues Section (Corkboard Style) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between sticky top-[72px] bg-slate-950/95 backdrop-blur py-3 z-20 border-b border-slate-800 shadow-md">
                <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-500" /> 
                  Evidence Board
                </h3>
                <div className="flex items-center gap-3">
                     <span className="text-xs text-slate-500 uppercase tracking-wider hidden sm:inline">Clues Found</span>
                     <span className="text-sm font-mono font-bold text-amber-500 bg-slate-900 px-3 py-1 rounded border border-slate-800 shadow-inner">
                        {revealedClues.length} / {mystery.clues.length}
                     </span>
                </div>
              </div>
              
              {/* Corkboard Container */}
              <div className="bg-cork p-4 sm:p-8 rounded-xl border-8 border-amber-900/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] min-h-[400px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mystery.clues.map((clue, index) => {
                      const isRevealed = revealedClues.includes(clue.id);
                      const isLocked = lockedClues.includes(clue.id);
                      // Random slight rotation for realism
                      const rotation = isRevealed ? (index % 2 === 0 ? 'rotate-1' : '-rotate-1') : 'rotate-0';

                      return (
                        <button
                          key={clue.id}
                          onClick={() => handleClueClick(clue.id)}
                          disabled={isRevealed || gameState !== GameState.Playing}
                          className={`
                            relative p-0 transition-all duration-300 group h-full
                            ${rotation} hover:scale-[1.02] hover:z-10 hover:rotate-0
                          `}
                        >
                          {/* Pin Graphic */}
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 drop-shadow-lg">
                             <Pin className={`w-6 h-6 fill-current ${isLocked ? 'text-red-600' : 'text-slate-300'} drop-shadow-md`} />
                          </div>

                          {/* Card Body */}
                          <div className={`
                             h-full flex flex-col text-left rounded-sm shadow-xl overflow-hidden
                             ${isRevealed 
                                ? 'bg-[#f8f5e6] text-slate-800' // Paper color
                                : 'bg-slate-800 text-slate-400 border-2 border-slate-700 border-dashed'}
                          `}>
                            
                            {/* Top Tape (Visual) */}
                            {isRevealed && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-8 bg-white/30 rotate-2 backdrop-blur-sm transform skew-x-12"></div>
                            )}

                            {isRevealed ? (
                                // Revealed Content (Paper Style)
                                <div className="p-6 pt-8">
                                    <div className="flex items-center gap-2 mb-3 border-b border-slate-300 pb-2">
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 flex-1">
                                            EVIDENCE #{clue.id}
                                        </span>
                                        <div className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1">
                                            {getClueIcon(clue.type)} {clue.type}
                                        </div>
                                    </div>
                                    <p className="font-serif text-lg leading-snug text-slate-900 animate-in fade-in slide-in-from-bottom-1 duration-500">
                                        {clue.text}
                                    </p>
                                    {/* Stamp for Context */}
                                    {clue.type === ClueType.Context && (
                                        <div className="absolute bottom-2 right-2 opacity-20 rotate-[-15deg] border-2 border-red-600 text-red-600 px-2 text-[10px] font-bold uppercase">
                                            Verified
                                        </div>
                                    )}
                                </div>
                            ) : isLocked ? (
                                // Locked Content
                                <div className="flex flex-col items-center justify-center py-10 px-6 h-full bg-slate-900/80 relative">
                                    <div className="caution-tape absolute top-0 left-0 w-full h-2"></div>
                                    <div className="p-4 bg-slate-950 rounded-full mb-4 border border-slate-800 group-hover:border-amber-500/50 transition-colors shadow-lg">
                                        <Lock className="w-8 h-8 text-amber-600" />
                                    </div>
                                    <h4 className="font-mono font-bold text-slate-300 mb-1 uppercase tracking-wider">Evidence Sealed</h4>
                                    <p className="text-xs text-slate-500 text-center mb-4">Forensic analysis required to unlock contents.</p>
                                    <span className="text-xs font-bold text-amber-500 group-hover:underline">Tap to Analyze</span>
                                    <div className="caution-tape absolute bottom-0 left-0 w-full h-2"></div>
                                </div>
                            ) : (
                                // Hidden Content
                                <div className="flex flex-col items-center justify-center py-10 h-full hover:bg-slate-700/30 transition-colors">
                                    <Search className="w-8 h-8 text-slate-600 mb-2 group-hover:text-slate-400" />
                                    <span className="text-sm font-medium font-mono uppercase tracking-widest opacity-60">Tap to Reveal</span>
                                </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
              </div>
            </div>

            {/* Hint System */}
            {gameState === GameState.Playing && (
                <div className="flex justify-center pt-4">
                    {!hint ? (
                        <Button variant="outline" onClick={fetchHint} isLoading={isHintLoading} disabled={revealedClues.length === 0} className="bg-slate-900/50 border-slate-700 hover:bg-slate-800">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            Radio HQ for a Hint
                        </Button>
                    ) : (
                        <div className="bg-amber-950/20 border border-amber-900/30 p-6 rounded-lg max-w-2xl w-full flex gap-5 animate-in fade-in slide-in-from-top-4 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Lightbulb className="w-24 h-24 text-amber-500" />
                            </div>
                            <div className="p-3 bg-slate-900 rounded-full h-fit border border-amber-900/50 z-10">
                                <Lightbulb className="w-6 h-6 text-amber-500 shrink-0" />
                            </div>
                            <div className="z-10">
                                <h5 className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">Chief's Memo</h5>
                                <p className="text-amber-100/90 text-lg italic font-serif leading-relaxed">"{hint}"</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <div ref={scrollRef} />

            {/* Floating Action Bar */}
            {gameState === GameState.Playing && (
              <div className="fixed bottom-8 left-0 right-0 px-4 flex justify-center z-20 pointer-events-none">
                 <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-700 p-2.5 rounded-2xl shadow-2xl pointer-events-auto transform transition-all hover:scale-105 hover:shadow-amber-900/40 hover:border-amber-500/50 ring-1 ring-black/50">
                    <Button 
                        variant="primary" 
                        className="w-64 h-14 text-lg shadow-lg shadow-amber-600/20 font-bold tracking-widest uppercase"
                        onClick={() => setGameState(GameState.Solving)}
                        disabled={revealedClues.length < 1}
                    >
                        <CheckCircle2 className="w-6 h-6 mr-2" />
                        Solve Case
                    </Button>
                 </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PUZZLE MODAL */}
      <Modal
        isOpen={activePuzzleClueId !== null}
        title=""
        onClose={() => setActivePuzzleClueId(null)}
      >
         <PuzzleGame 
            onSuccess={handlePuzzleSuccess}
            onFailure={() => {}}
            onClose={() => setActivePuzzleClueId(null)}
            difficulty={selectedDifficulty}
         />
      </Modal>

      {/* SOLVING MODAL (SUSPECT LINEUP) */}
      <Modal 
        isOpen={gameState === GameState.Solving} 
        title="Suspect Lineup"
        onClose={() => setGameState(GameState.Playing)}
      >
        <div className="space-y-6">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                <p className="text-slate-300 text-sm italic font-serif">
                    "Review the suspects. Only one is the culprit."
                </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {mystery?.options.map((option, idx) => (
                    <button
                        key={option.id}
                        onClick={() => setSelectedOption(option.id)}
                        className={`
                            relative flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all group overflow-hidden
                            ${selectedOption === option.id 
                                ? 'bg-amber-900/20 border-amber-500 shadow-[inset_0_0_20px_rgba(245,158,11,0.2)]' 
                                : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'}
                        `}
                    >
                        {/* Background height marks */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none flex justify-between px-2">
                            <div className="w-px h-full bg-slate-500 border-l border-dashed"></div>
                            <div className="w-px h-full bg-slate-500 border-l border-dashed"></div>
                        </div>

                        {/* Mugshot Icon */}
                        <div className={`
                            w-16 h-16 rounded-lg mb-3 flex items-center justify-center border-2 shadow-inner
                            ${selectedOption === option.id ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700 group-hover:bg-slate-700'}
                        `}>
                            <UserIcon className={`w-10 h-10 ${selectedOption === option.id ? 'text-slate-900' : 'text-slate-500'}`} />
                        </div>
                        
                        <span className={`font-bold text-sm ${selectedOption === option.id ? 'text-amber-400' : 'text-slate-300'}`}>
                            {option.text}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Suspect #{idx + 1}</span>
                    </button>
                ))}
            </div>

            <Button 
                className="w-full mt-4 h-12 text-lg" 
                disabled={!selectedOption}
                onClick={submitSolution}
                size="lg"
            >
                Confirm Indictment
            </Button>
        </div>
      </Modal>

      {/* RESULTS MODALS */}
      <Modal isOpen={gameState === GameState.Success} title="CASE CLOSED" onClose={() => {}}>
        <div className="text-center space-y-6 pt-2">
            <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/30 animate-in zoom-in duration-300 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            </div>
            <div>
                <h4 className="text-3xl font-serif font-bold text-emerald-400 mb-2">Justice Served!</h4>
                <div className="text-slate-300 text-sm leading-relaxed text-left bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-inner relative mt-4">
                    <div className="absolute -top-3 -left-2 rotate-[-10deg] bg-emerald-600 text-slate-950 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest shadow-sm">Solved</div>
                    <p className="font-serif italic opacity-90">{mystery?.explanation}</p>
                </div>
            </div>
            
            <div className="bg-amber-950/30 rounded-lg p-4 flex items-center justify-center gap-3 border border-amber-900/50">
               <Trophy className="w-6 h-6 text-amber-500" />
               <div className="flex flex-col text-left">
                   <span className="text-xs text-amber-500/70 uppercase tracking-wider font-bold">Reward Issued</span>
                   <span className="text-amber-100 font-mono text-xl font-bold">+{xpGained} XP</span>
               </div>
            </div>

            <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => startGame(selectedDifficulty)}>
                    Next Case
                </Button>
                <Button variant="outline" className="flex-1" onClick={resetGame}>
                    Dashboard
                </Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={gameState === GameState.Failure} title="CASE COLD" onClose={() => setGameState(GameState.Playing)}>
         <div className="text-center space-y-6 pt-2">
            <div className="w-28 h-28 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-red-500/30 animate-in shake duration-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <X className="w-14 h-14 text-red-500" />
            </div>
            <div>
                <h4 className="text-3xl font-serif font-bold text-red-400 mb-2">Objection!</h4>
                <p className="text-slate-400 text-lg">
                    Your deduction has holes in it, detective. The Chief isn't happy.
                </p>
            </div>
            <div className="flex gap-3 flex-col pt-4">
                 <Button variant="primary" size="lg" onClick={() => setGameState(GameState.Playing)}>
                    <Search className="w-4 h-4 mr-2" />
                    Re-examine Evidence
                </Button>
                <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => setGameState(GameState.Success)}>
                    I Give Up (Reveal Answer)
                </Button>
            </div>
        </div>
      </Modal>

      {/* LEVEL UP MODAL */}
      <Modal isOpen={showLevelUp} title="PROMOTION" onClose={() => setShowLevelUp(false)}>
         <div className="text-center space-y-8 py-4">
             <div className="relative w-32 h-32 mx-auto">
               <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20 animate-pulse"></div>
               <div className="relative w-full h-full bg-gradient-to-br from-amber-300 to-amber-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-amber-200/50 transform rotate-12 hover:rotate-0 transition-transform duration-500">
                  <Star className="w-16 h-16 text-white fill-white drop-shadow-md" />
               </div>
             </div>
             <div>
                <h4 className="text-3xl font-serif font-bold text-amber-400 mb-2">Level Up!</h4>
                <p className="text-slate-300 text-lg">
                  You are now a Level <span className="text-amber-400 font-bold text-2xl mx-1">{user?.level}</span> Detective.
                </p>
                <p className="text-slate-500 text-sm mt-2">The coffee machine is now slightly more afraid of you.</p>
             </div>
             <Button onClick={() => setShowLevelUp(false)} className="w-full" size="lg">Accept Promotion</Button>
         </div>
      </Modal>

    </div>
  );
}

// Helper for icons
function getClueIcon(type: string) {
    switch(type) {
        case "Observation": return <Eye className="w-3 h-3 text-sky-600" />;
        case "Testimony": return <MessageSquare className="w-3 h-3 text-purple-600" />;
        case "Physical Object": return <Search className="w-3 h-3 text-emerald-600" />;
        default: return <Archive className="w-3 h-3 text-slate-600" />;
    }
}