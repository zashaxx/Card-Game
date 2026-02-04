import React, { useEffect, useState, useMemo, useRef } from 'react';
import { CardData, GameState, Player, HandType, Rank, Suit, GameStatus } from '../types';
import Card from './Card';
import { playCardFlip, playSuccess, playReset, playError } from '../utils/audio';
import { sortCards, isValidMove } from '../utils/gameLogic';

interface GameTableProps {
  gameState: GameState;
  myPlayerId: string;
  onPlayCards: (cards: CardData[], isReset: boolean) => void;
  onPass: () => void;
  onExit: () => void;
}

const GameTable: React.FC<GameTableProps> = ({ gameState, myPlayerId, onPlayCards, onPass, onExit }) => {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Feedback State Map
  const [playerFeedback, setPlayerFeedback] = useState<{[key:string]: {text: string, type: 'pass' | 'reset'}}>({});
  
  const [pileAnimClass, setPileAnimClass] = useState('');
  const prevPlayers = useRef<Player[]>(gameState.players);
  const prevPile = useRef<any>(gameState.pile);

  const [timePct, setTimePct] = useState(100);

  const me = gameState.players.find(p => p.id === myPlayerId);
  const myHand = useMemo(() => me ? sortCards(me.hand || []) : [], [me]);

  const isMyTurn = gameState.currentPlayerId === myPlayerId;
  const isPlaying = gameState.status === GameStatus.Playing;
  const isDealing = gameState.status === GameStatus.Dealing;
  const isShuffling = gameState.status === GameStatus.Shuffling;

  // --- Effects ---
  useEffect(() => {
    if (gameState.turnDeadline && isPlaying) {
        const interval = setInterval(() => {
            const total = 30000;
            const remaining = gameState.turnDeadline! - Date.now();
            const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
            setTimePct(pct);
        }, 100);
        return () => clearInterval(interval);
    }
  }, [gameState.turnDeadline, isPlaying]);

  useEffect(() => {
    // 1. Detect Pass
    gameState.players.forEach((p) => {
        const prevP = prevPlayers.current.find(pp => pp.id === p.id);
        if (p.lastAction === 'PASS' && prevP?.lastAction !== 'PASS') {
             triggerPlayerFeedback(p.id, "PASS", 'pass');
        }
    });

    // 2. Detect New Pile / Reset
    if (gameState.pile && gameState.pile !== prevPile.current) {
         const playerId = gameState.pile.playerId;
         const player = gameState.players.find(p => p.id === playerId);
         const pName = player?.name || "Unknown";

         if (gameState.pile.type === HandType.Reset) {
            triggerPlayerFeedback(playerId, `RESET (2)`, 'reset');
            playReset();
         } else {
            playSuccess();
         }

         setPileAnimClass('animate-pop');
    }

    prevPlayers.current = gameState.players;
    prevPile.current = gameState.pile;

  }, [gameState.players, gameState.pile, myPlayerId]);

  const triggerPlayerFeedback = (playerId: string, text: string, type: 'pass' | 'reset') => {
      setPlayerFeedback(prev => ({ ...prev, [playerId]: { text, type } }));
      setTimeout(() => {
          setPlayerFeedback(prev => {
              const next = { ...prev };
              delete next[playerId];
              return next;
          });
      }, 2000);
  };

  // --- Layout Helpers ---
  const getOpponentStyle = (index: number, total: number) => {
    const relativeIndex = (index - gameState.players.findIndex(p => p.id === myPlayerId) + total) % total;

    const slots = [
        {}, // 0
        { top: '45%', right: '2%', transform: 'translateY(-50%)' }, // 1
        { top: '5%', right: '10%' }, // 2
        { top: '5%', left: '50%', transform: 'translateX(-50%)' }, // 3
        { top: '5%', left: '10%' }, // 4
        { top: '45%', left: '2%', transform: 'translateY(-50%)' }, // 5
    ];

    if (total === 2) { 
       if (relativeIndex === 1) return slots[3]; 
    }
    if (total === 3) {
       if (relativeIndex === 1) return slots[2]; 
       if (relativeIndex === 2) return slots[4]; 
    }
    if (total === 4) {
       if (relativeIndex === 1) return slots[1]; 
       if (relativeIndex === 2) return slots[2]; // Adjusted for better 4 player view
       if (relativeIndex === 3) return slots[5];
    }
    if (total === 5) {
       if (relativeIndex === 1) return slots[1]; 
       if (relativeIndex === 2) return slots[2]; 
       if (relativeIndex === 3) return slots[4]; 
       if (relativeIndex === 4) return slots[5]; 
    }
    return slots[relativeIndex] || slots[1];
  };

  const toggleCardSelection = (cardId: string) => {
    if (!isMyTurn || !isPlaying) return;
    const newSet = new Set(selectedCardIds);
    if (newSet.has(cardId)) {
      newSet.delete(cardId);
    } else {
      newSet.add(cardId);
    }
    setSelectedCardIds(newSet);
    playCardFlip();
  };

  const handlePlay = () => {
    if (!isMyTurn || !isPlaying) return;
    const selectedCards = myHand.filter(c => selectedCardIds.has(c.id));
    const result = isValidMove(selectedCards, gameState.pile, myHand.length);

    if (result.valid) {
      onPlayCards(selectedCards, result.isReset);
      setSelectedCardIds(new Set());
      setErrorMsg(null);
    } else {
      playError();
      setErrorMsg(result.message || "Invalid Move");
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const getAvatar = (name: string, isBot?: boolean) => 
    `https://ui-avatars.com/api/?name=${name}&background=${isBot ? '6366f1' : '10b981'}&color=fff&rounded=true&bold=true`;

  return (
    <div className="relative w-full h-full min-h-screen bg-[#2d5a35] overflow-hidden font-sans select-none">
      <div className="absolute inset-0 opacity-40 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, transparent 20%, #000 120%)' }}></div>
      
      <style>{`
        .animate-pop { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards; }
        @keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* --- Header / Exit --- */}
      <div className="absolute top-0 left-0 w-full z-40 p-4 flex justify-between items-start pointer-events-none">
          <button 
             onClick={onExit}
             className="pointer-events-auto bg-black/40 hover:bg-red-600/80 text-white/70 hover:text-white p-2 rounded-full transition-all backdrop-blur-sm shadow-lg border border-white/10"
             title="Exit Game"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
          </button>
          
          {isPlaying && (
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900">
                  <div 
                    className={`h-full transition-all duration-100 ease-linear ${timePct < 20 ? 'bg-red-500' : 'bg-yellow-400'}`}
                    style={{ width: `${timePct}%` }}
                  ></div>
              </div>
          )}
      </div>

      {/* --- Shuffling Overlay --- */}
      {isShuffling && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <h2 className="text-white text-3xl font-bold animate-pulse tracking-widest">SHUFFLING</h2>
        </div>
      )}

      {/* --- CENTER AREA (Pile) --- */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 w-64 h-64 flex flex-col items-center justify-center pointer-events-none">
         
         {/* Dealing Deck Animation */}
         {isDealing && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-24 h-36 bg-blue-800 rounded-lg border-2 border-white shadow-2xl"></div>
             </div>
         )}
         
         {/* Active Pile */}
         {!isShuffling && !isDealing && gameState.pile ? (
           <div className={`relative flex flex-col items-center w-full h-full ${pileAnimClass}`} key={gameState.pile.cards[0]?.id}>
             
             {/* Type Badge */}
             <div className="absolute -top-16 bg-black/60 px-4 py-1.5 rounded-full text-yellow-300 font-black uppercase tracking-widest text-sm shadow-lg border border-white/20">
                {gameState.pile.type}
             </div>

             {/* Cards */}
             <div className="relative w-full h-full flex items-center justify-center">
                {gameState.pile.cards.map((card, idx) => {
                    const total = gameState.pile!.cards.length;
                    const spread = 40; 
                    const offset = (idx - (total - 1) / 2) * spread;
                    
                    return (
                        <div 
                            key={card.id} 
                            className="absolute transition-all duration-300 shadow-2xl rounded-lg"
                            style={{ 
                                transform: `translateX(${offset}px) rotate(${offset * 0.1}deg)`,
                                zIndex: idx
                            }}
                        >
                            <Card card={card} />
                        </div>
                    );
                })}
             </div>
             
             {/* Played By Badge */}
             <div className="absolute -bottom-16 flex flex-col items-center">
                 <div className="text-white/60 text-[10px] uppercase font-bold tracking-wider mb-1">Played By</div>
                 <div className="bg-blue-900/80 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md border border-blue-400/30">
                    {gameState.players.find(p => p.id === gameState.pile!.playerId)?.name}
                 </div>
             </div>
           </div>
         ) : (
            !isShuffling && !isDealing && (
                <div className="w-24 h-36 border-4 border-dashed border-white/10 rounded-xl flex items-center justify-center opacity-30">
                    <span className="text-white font-bold tracking-widest text-sm">EMPTY</span>
                </div>
            )
         )}
      </div>

      {/* --- OPPONENTS --- */}
      {gameState.players.map((player, idx) => {
        if (player.id === myPlayerId) return null;
        const style = getOpponentStyle(idx, gameState.players.length);
        const isCurrent = gameState.currentPlayerId === player.id;
        const feedback = playerFeedback[player.id];

        return (
          <div key={player.id} className="absolute w-32 flex flex-col items-center transition-all duration-500 z-20" style={style}>
             
             <div className="relative flex flex-col items-center">
                 {/* Feedback Notification */}
                 {feedback && (
                    <div className="absolute bottom-full mb-3 z-50 animate-bounce">
                        <div className={`
                            px-4 py-2 rounded-xl border shadow-xl whitespace-nowrap text-xs font-black tracking-wider uppercase
                            ${feedback.type === 'reset' 
                                ? 'bg-yellow-400 text-black border-white' 
                                : 'bg-red-600 text-white border-red-300'}
                        `}>
                            {feedback.text}
                        </div>
                    </div>
                 )}

                 <div className={`
                    relative p-1 rounded-full transition-all duration-300 
                    ${isCurrent ? 'ring-4 ring-yellow-400 bg-yellow-400/20 scale-105' : 'ring-0'}
                 `}>
                    <img src={getAvatar(player.name, player.isBot)} className="w-16 h-16 rounded-full shadow-lg bg-gray-800 object-cover border-2 border-white/10" alt={player.name} />
                    
                    {player.isFinished && (
                        <span className="absolute -top-1 -right-1 bg-yellow-500 text-black font-black w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-md z-20 border border-white">
                            #{player.rank}
                        </span>
                    )}
                 </div>

                 <div className="mt-[-14px] z-10 flex flex-col items-center gap-1">
                     <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full border border-slate-600 shadow-md max-w-full truncate">
                        {player.name}
                     </div>
                     {!player.isFinished && (
                         <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                            {player.handCount} CARDS
                         </div>
                     )}
                 </div>
             </div>
          </div>
        );
      })}

      {/* --- PLAYER HAND & CONTROLS --- */}
      {/* Container wrapper for Hand + Buttons */}
      <div className="absolute bottom-0 left-0 w-full h-auto pointer-events-none z-30 flex items-end justify-between px-2 pb-2 sm:px-6 sm:pb-4">

          {/* 1. Player Hand (Centered / Left dominant but constrained) */}
          {/* We use flex-grow to take space but max-width to leave room for buttons */}
          <div className="flex-1 flex justify-center items-end relative h-32 sm:h-40 pointer-events-auto mr-4" style={{ maxWidth: 'calc(100% - 160px)' }}>
            
            {/* My Feedback Notification */}
            {playerFeedback[myPlayerId] && (
                <div className="absolute bottom-full mb-4 z-50 animate-bounce">
                    <div className={`
                        px-6 py-2 rounded-xl border-2 shadow-xl whitespace-nowrap text-lg font-black tracking-wider uppercase
                        ${playerFeedback[myPlayerId].type === 'reset' 
                            ? 'bg-yellow-400 text-black border-white' 
                            : 'bg-red-600 text-white border-red-300'}
                    `}>
                        {playerFeedback[myPlayerId].text}
                    </div>
                </div>
            )}

            {!isShuffling && (
                <div className="flex items-end justify-center w-full h-full relative perspective-1000">
                    {myHand.map((card, idx) => {
                        const total = myHand.length;
                        
                        // Dynamic Margin Calculation
                        // Assume card visual width ~96px (w-24).
                        // If we have strict constraints, we pull them back.
                        const cardBaseWidth = 60; // Approximate "useful" width for calculation
                        const maxContainerWidth = Math.min(window.innerWidth * 0.75, 800);
                        
                        let marginRight = -30; // Default overlap
                        const totalNeeded = total * cardBaseWidth;
                        
                        if (totalNeeded > maxContainerWidth) {
                            // Squash more
                            marginRight = -1 * (1 - (maxContainerWidth / totalNeeded)) * 80;
                            // Cap squash
                            marginRight = Math.max(marginRight, -70);
                        } else if (total < 5) {
                            marginRight = -10;
                        }

                        // Fan Rotation
                        const centerIdx = (total - 1) / 2;
                        const rotate = (idx - centerIdx) * 2;
                        const translateY = Math.abs(idx - centerIdx) * 2;
                        
                        const isSel = selectedCardIds.has(card.id);

                        return (
                            <div 
                                key={card.id}
                                className={`
                                    relative transition-all duration-200 ease-out origin-bottom
                                    ${isSel 
                                        ? 'z-50 mb-8 scale-110' 
                                        : 'hover:mb-6 hover:scale-110 hover:z-40 z-auto' // Hover effects
                                    }
                                `}
                                style={{
                                    marginRight: idx === total - 1 ? 0 : `${marginRight}px`,
                                    transform: isSel 
                                        ? `rotate(${rotate}deg)` 
                                        : `rotate(${rotate}deg) translateY(${translateY}px)`,
                                    zIndex: isSel ? 100 : idx // maintain stacking context unless selected
                                }}
                            >
                                <Card 
                                    card={card} 
                                    isSelected={isSel} 
                                    onClick={() => toggleCardSelection(card.id)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
          </div>

          {/* 2. Action Buttons (Fixed Right Column) */}
          <div className="flex flex-col items-end gap-3 pointer-events-auto min-w-[140px]">
            {errorMsg && (
              <div className="bg-red-600 text-white px-4 py-2 rounded-lg animate-bounce text-xs font-bold shadow-lg mb-2 text-center w-full">
                {errorMsg}
              </div>
            )}

            {isMyTurn && isPlaying && (
                 <div className="bg-yellow-400 text-black px-4 py-1.5 rounded-full font-black text-xs sm:text-sm uppercase shadow-lg animate-pulse border-2 border-white text-center w-full">
                     YOUR TURN
                 </div>
            )}

            <div className="flex flex-col gap-2 w-full">
                <button 
                  disabled={!isMyTurn || !isPlaying}
                  onClick={handlePlay}
                  className={`
                    w-full py-4 rounded-xl font-bold text-white shadow-xl uppercase tracking-wider transition-all border-b-4 text-sm sm:text-base
                    ${isMyTurn && isPlaying 
                        ? 'bg-blue-600 border-blue-800 hover:bg-blue-500 hover:border-blue-700 active:border-b-0 active:translate-y-1' 
                        : 'bg-slate-600 border-slate-800 opacity-50 cursor-not-allowed'}
                  `}
                >
                  Play
                </button>
                <button 
                  disabled={!isMyTurn || !isPlaying}
                  onClick={onPass}
                  className={`
                    w-full py-3 rounded-xl font-bold text-white shadow-xl uppercase tracking-wider transition-all border-b-4 text-xs sm:text-sm
                    ${isMyTurn && isPlaying 
                        ? 'bg-red-500 border-red-700 hover:bg-red-400 hover:border-red-600 active:border-b-0 active:translate-y-1' 
                        : 'bg-slate-600 border-slate-800 opacity-50 cursor-not-allowed'}
                  `}
                >
                  Pass
                </button>
            </div>
          </div>

      </div>
    </div>
  );
};

export default GameTable;