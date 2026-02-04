import React, { useEffect, useState, useRef } from 'react';
import { GameState, GameStatus, Player, CardData, NetworkMessage, PlayedHand, HandType, Rank } from './types';
import Menu from './components/Menu';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import { peerService } from './services/peerService';
import { createDeck, sortCards, getBotMove, identifyHandType, isValidMove } from './utils/gameLogic';
import { playDeal } from './utils/audio';

const TURN_LIMIT_MS = 30000;

const App: React.FC = () => {
  const [myId, setMyId] = useState<string>('');
  const [hostId, setHostId] = useState<string>('');
  const [myName, setMyName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Game State Source of Truth
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerId: null,
    lastLoserId: null,
    pile: null,
    status: GameStatus.Lobby,
    deck: [],
    winners: []
  });

  // URL Parameter Check for Joining
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game');
    if (gameId) {
        // Auto-fill logic handled in Menu via copy-paste or simple state pass if we wanted to auto-join
    }
  }, []);

  // --- Turn Timer (Host Only) ---
  useEffect(() => {
    if (!isHost || gameState.status !== GameStatus.Playing) return;
    
    const interval = setInterval(() => {
        if (gameState.turnDeadline && Date.now() > gameState.turnDeadline) {
             if (gameState.currentPlayerId) {
                 processPass(gameState.currentPlayerId);
             }
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, gameState.status, gameState.turnDeadline, gameState.currentPlayerId]);

  // --- Bot AI Effect (Host Only) ---
  useEffect(() => {
    if (!isHost || gameState.status !== GameStatus.Playing) return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    
    // Check if current player is a bot and not finished
    if (currentPlayer && currentPlayer.isBot && !currentPlayer.isFinished) {
        const delay = Math.random() * 1000 + 1000; // 1-2 seconds
        const timer = setTimeout(() => {
            const move = getBotMove(currentPlayer.hand!, gameState.pile);
            if (move) {
                // Double check validity with hand length rule
                const check = isValidMove(move.cards, gameState.pile, currentPlayer.hand!.length);
                if (check.valid) {
                    processMove(currentPlayer.id, move.cards, move.isReset);
                } else {
                    processPass(currentPlayer.id);
                }
            } else {
                processPass(currentPlayer.id);
            }
        }, delay);
        return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayerId, gameState.status, isHost, gameState.pile, gameState.players]); 


  // --- Network Handlers ---

  const handleHostGame = async (name: string) => {
    setIsConnecting(true);
    setMyName(name);
    setIsHost(true);
    
    try {
      const id = await peerService.initialize();
      setMyId(id);
      setHostId(id);
      
      const hostPlayer: Player = {
        id: id,
        name: name,
        isHost: true,
        handCount: 0,
        hand: [],
        isFinished: false,
        rank: null
      };
      
      setGameState(prev => ({
        ...prev,
        players: [hostPlayer],
        status: GameStatus.Lobby
      }));
      
      peerService.onData = (data: any, senderId: string) => {
        handleHostMessage(data as NetworkMessage, senderId);
      };
      
    } catch (e) {
      alert("Failed to initialize PeerJS. " + e);
    }
    setIsConnecting(false);
  };

  const handleJoinGame = async (name: string, targetHostId: string) => {
    setIsConnecting(true);
    setMyName(name);
    
    try {
      const id = await peerService.initialize();
      setMyId(id);
      setHostId(targetHostId);
      
      peerService.connectToHost(targetHostId);
      
      peerService.onConnect = () => {
        peerService.sendToHost({
          type: 'JOIN',
          payload: { name: name, id: id }
        });
      };

      peerService.onData = (data: any) => {
        handleClientMessage(data as NetworkMessage);
      };

      peerService.onDisconnect = () => {
        alert("Disconnected from host");
        window.location.reload();
      };

    } catch (e) {
      alert("Connection failed");
    }
    setIsConnecting(false);
  };

  // --- Host Logic (The Source of Truth) ---

  const handleHostMessage = (msg: NetworkMessage, senderId: string) => {
    if (msg.type === 'JOIN') {
      const { name, id } = msg.payload;
      setGameState(prev => {
        if (prev.players.find(p => p.id === id)) return prev;
        if (prev.players.length >= 6) return prev;

        const newPlayer: Player = {
          id, name, isHost: false, handCount: 0, hand: [], isFinished: false, rank: null
        };
        const newState = { ...prev, players: [...prev.players, newPlayer] };
        
        broadcastGameState(newState);
        return newState;
      });
    }

    if (msg.type === 'PLAY_CARDS') {
        processMove(senderId, msg.payload.cards, msg.payload.isReset);
    }

    if (msg.type === 'PASS') {
        processPass(senderId);
    }

    if (msg.type === 'LEAVE') {
        handlePlayerLeave(msg.payload.id);
    }
  };

  const handlePlayerLeave = (playerId: string) => {
    setGameState(prev => {
        const remainingPlayers = prev.players.filter(p => p.id !== playerId);
        
        // If the current player left, move to next
        let nextPlayerId = prev.currentPlayerId;
        if (prev.currentPlayerId === playerId) {
            nextPlayerId = getNextActivePlayerId(remainingPlayers, playerId, 0) || null; // 0 because index shifted
        }

        // If not enough players, end game
        let status = prev.status;
        if (remainingPlayers.length < 2 && status === GameStatus.Playing) {
            status = GameStatus.GameOver;
        }

        const newState = {
            ...prev,
            players: remainingPlayers,
            currentPlayerId: nextPlayerId,
            status
        };
        broadcastGameState(newState);
        return newState;
    });
  };

  const broadcastGameState = (state: GameState) => {
    peerService.broadcast({
      type: 'GAME_STATE_UPDATE',
      payload: state
    });
  };

  // --- Client Logic ---

  const handleClientMessage = (msg: NetworkMessage) => {
    if (msg.type === 'GAME_STATE_UPDATE') {
      const newState = msg.payload as GameState;
      setGameState(newState);
    }
  };

  // --- Bot Management ---
  const handleAddBot = () => {
    if (gameState.players.length >= 6) return;
    const botId = `bot-${Date.now()}`;
    const botName = `Bot ${Math.floor(Math.random() * 100)}`;
    
    const botPlayer: Player = {
      id: botId,
      name: botName,
      isHost: false,
      isBot: true,
      handCount: 0,
      hand: [],
      isFinished: false,
      rank: null
    };

    setGameState(prev => {
      const newState = { ...prev, players: [...prev.players, botPlayer] };
      broadcastGameState(newState);
      return newState;
    });
  };

  const handleRemoveBot = (botId: string) => {
    setGameState(prev => {
      const newState = { ...prev, players: prev.players.filter(p => p.id !== botId) };
      broadcastGameState(newState);
      return newState;
    });
  };

  // --- Game Mechanics (Host Only) ---

  const startGame = () => {
    if (!isHost) return;
    
    // 1. Setup Data
    let dealerIndex = 0;
    if (gameState.lastLoserId) {
        const idx = gameState.players.findIndex(p => p.id === gameState.lastLoserId);
        if (idx !== -1) dealerIndex = idx;
    }
    
    const deck = createDeck();
    const players = [...gameState.players];
    const playerCount = players.length;
    
    const hands: { [key: string]: CardData[] } = {};
    players.forEach(p => hands[p.id] = []);
    
    let currentDealIndex = (dealerIndex - 1 + playerCount) % playerCount;
    const startingPlayerId = players[currentDealIndex].id;

    deck.forEach(card => {
        hands[players[currentDealIndex].id].push(card);
        currentDealIndex = (currentDealIndex - 1 + playerCount) % playerCount;
    });

    const updatedPlayers = players.map(p => ({
        ...p,
        hand: sortCards(hands[p.id]),
        handCount: hands[p.id].length,
        isFinished: false,
        rank: null,
        lastAction: null // Clear previous actions
    }));

    // 2. Animation Sequence
    // Phase 1: Shuffling
    const shufflingState: GameState = {
        ...gameState,
        players: updatedPlayers, // We set hands but GameTable will hide them based on status
        status: GameStatus.Shuffling,
        pile: null,
        winners: []
    };
    setGameState(shufflingState);
    broadcastGameState(shufflingState);

    // Phase 2: Dealing (after 2s)
    setTimeout(() => {
        const dealingState: GameState = {
            ...shufflingState,
            status: GameStatus.Dealing
        };
        setGameState(dealingState);
        broadcastGameState(dealingState);
        playDeal();

        // Phase 3: Playing (after another 1.5s)
        setTimeout(() => {
            const playingState: GameState = {
                ...dealingState,
                currentPlayerId: startingPlayerId,
                status: GameStatus.Playing,
                turnDeadline: Date.now() + TURN_LIMIT_MS
            };
            setGameState(playingState);
            broadcastGameState(playingState);
        }, 1500);

    }, 2000);
  };

  const processMove = (playerId: string, cards: CardData[], isReset: boolean) => {
    if (!isHost) return;

    setGameState(prev => {
        const playerIndex = prev.players.findIndex(p => p.id === playerId);
        const player = prev.players[playerIndex];
        
        // Host-side Validation
        if (prev.currentPlayerId !== playerId) {
            console.warn(`Player ${playerId} tried to move out of turn`);
            return prev;
        }

        const validCheck = isValidMove(cards, prev.pile, player.hand!.length);
        if (!validCheck.valid) {
             console.warn(`Invalid move by ${playerId}: ${validCheck.message}`);
             // Note: In a real app we might want to send an error message back to the client
             // For now we just ignore the invalid update
             return prev;
        }

        const currentHand = player.hand || [];
        const newHand = currentHand.filter(c => !cards.find(played => played.id === c.id));
        
        const updatedPlayer = {
            ...player,
            hand: newHand,
            handCount: newHand.length,
            lastAction: 'PLAY' as const 
        };
        
        let winners = [...prev.winners];
        let wasFinished = player.isFinished;
        if (newHand.length === 0 && !wasFinished) {
            updatedPlayer.isFinished = true;
            updatedPlayer.rank = winners.length + 1;
            winners.push(updatedPlayer.id);
        }

        const updatedPlayers = [...prev.players];
        updatedPlayers[playerIndex] = updatedPlayer;

        let nextPlayerId = prev.currentPlayerId;
        let nextPile = prev.pile;

        if (isReset) {
            nextPile = null;
            nextPlayerId = playerId;
            
            if (updatedPlayer.isFinished) {
                 nextPlayerId = getNextActivePlayerId(updatedPlayers, playerId, -1);
                 nextPile = null;
            }
        } else {
            nextPile = {
                cards: cards,
                type: isReset ? HandType.Reset : prev.pile?.type || identifyHandType(cards)!,
                playerId: playerId
            };
            nextPlayerId = getNextActivePlayerId(updatedPlayers, playerId, -1);
        }

        const activePlayers = updatedPlayers.filter(p => !p.isFinished);
        let lastLoserId = prev.lastLoserId;
        let status = prev.status;

        if (activePlayers.length <= 1) {
             status = GameStatus.GameOver;
             if (activePlayers.length === 1) {
                lastLoserId = activePlayers[0].id;
            } else {
                lastLoserId = playerId; 
            }
        }

        const newState = {
            ...prev,
            players: updatedPlayers,
            pile: nextPile,
            currentPlayerId: nextPlayerId,
            winners,
            status,
            lastLoserId,
            turnDeadline: Date.now() + TURN_LIMIT_MS
        };
        
        broadcastGameState(newState);
        return newState;
    });
  };

  const processPass = (playerId: string) => {
    if (!isHost) return;

    setGameState(prev => {
        // 1. Update player action to PASS
        const playerIndex = prev.players.findIndex(p => p.id === playerId);
        const updatedPlayers = [...prev.players];
        updatedPlayers[playerIndex] = {
            ...updatedPlayers[playerIndex],
            lastAction: 'PASS'
        };

        // 2. Find next potential player
        let nextPlayerId = getNextActivePlayerId(updatedPlayers, playerId, -1);
        let nextPile = prev.pile;

        // 3. Round End Logic:
        
        if (nextPile) {
            const pileOwnerId = nextPile.playerId;
            const pileOwner = updatedPlayers.find(p => p.id === pileOwnerId);

            if (nextPlayerId === pileOwnerId) {
                // The pile owner is active and it's their turn again -> Clear pile
                nextPile = null;
            } else if (pileOwner && pileOwner.isFinished) {
                // Pile owner finished, check for ghost pass
                const firstActiveAfterWinner = getNextActivePlayerId(updatedPlayers, pileOwnerId, -1);
                
                if (nextPlayerId === firstActiveAfterWinner) {
                    nextPile = null; 
                }
            }
        }
        
        const newState = {
            ...prev,
            players: updatedPlayers,
            currentPlayerId: nextPlayerId,
            pile: nextPile,
            turnDeadline: Date.now() + TURN_LIMIT_MS
        };
        broadcastGameState(newState);
        return newState;
    });
  };

  const getNextActivePlayerId = (players: Player[], currentId: string, direction: number) => {
    let idx = players.findIndex(p => p.id === currentId);
    let count = players.length;
    let loopGuard = 0;
    
    // Safety check if no active players
    if (players.length === 0) return null;

    while(loopGuard < count) {
        idx = (idx + direction + count) % count;
        if (!players[idx].isFinished) {
            return players[idx].id;
        }
        loopGuard++;
    }
    // Fallback if everyone finished
    return null; 
  };


  // --- UI Interactions ---

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?game=${hostId}`;
    navigator.clipboard.writeText(url);
    alert("Link copied!");
  };

  const handleExit = () => {
      const confirmExit = window.confirm("Are you sure you want to leave the game?");
      if(confirmExit) {
          if (!isHost) {
             peerService.sendToHost({ type: 'LEAVE', payload: { id: myId } });
          }
          // Delay redirect to ensure message sends
          setTimeout(() => {
              window.location.href = window.location.origin;
          }, 300);
      }
  }

  const handleClientPlay = (cards: CardData[], isReset: boolean) => {
    if (isHost) {
        processMove(myId, cards, isReset);
    } else {
        peerService.sendToHost({
            type: 'PLAY_CARDS',
            payload: { cards, isReset }
        });
    }
  };

  const handleClientPass = () => {
    if (isHost) {
        processPass(myId);
    } else {
        peerService.sendToHost({ type: 'PASS', payload: {} });
    }
  };

  const handleRestart = () => {
    if (!isHost) return;
    startGame();
  };


  // --- Render ---

  if (gameState.status === GameStatus.Lobby) {
    if (!myId) {
      return <Menu onHost={handleHostGame} onJoin={handleJoinGame} isConnecting={isConnecting} />;
    }
    return (
        <Lobby 
            gameId={hostId} 
            players={gameState.players} 
            isHost={isHost}
            onStart={startGame}
            onCopy={handleCopyLink}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
        />
    );
  }

  return (
    <>
        <GameTable 
            gameState={gameState} 
            myPlayerId={myId}
            onPlayCards={handleClientPlay}
            onPass={handleClientPass}
            onExit={handleExit}
        />
        {gameState.status === GameStatus.GameOver && (
             <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                 <div className="bg-white p-8 rounded-xl text-center animate-bounce-in max-w-lg w-full">
                     <h2 className="text-4xl font-bold mb-4 text-black">Game Over!</h2>
                     <div className="mb-6 space-y-2 max-h-64 overflow-y-auto">
                        {gameState.winners.map((wid, idx) => {
                            const p = gameState.players.find(pl => pl.id === wid);
                            return <div key={wid} className="text-xl flex justify-between px-8">
                                <span>{idx+1}.</span>
                                <span>{p?.name}</span>
                            </div>
                        })}
                        <div className="text-red-500 font-bold mt-4 pt-4 border-t">
                            Dealer: {gameState.players.find(p => p.id === gameState.lastLoserId)?.name || 'None'}
                        </div>
                     </div>
                     <div className="flex flex-col gap-2">
                        {isHost && (
                            <button 
                                onClick={handleRestart}
                                className="bg-green-600 text-white px-8 py-3 rounded-full font-bold hover:bg-green-500 w-full"
                            >
                                Next Round
                            </button>
                        )}
                        <button 
                             onClick={handleExit}
                             className="bg-gray-200 text-gray-800 px-8 py-3 rounded-full font-bold hover:bg-gray-300 w-full"
                         >
                             Exit Game
                        </button>
                     </div>
                     {!isHost && <div className="text-gray-500 mt-2">Waiting for host...</div>}
                 </div>
             </div>
        )}
    </>
  );
};

export default App;