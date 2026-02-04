import React from 'react';
import { Player } from '../types';

interface LobbyProps {
  gameId: string;
  players: Player[];
  isHost: boolean;
  onStart: () => void;
  onCopy: () => void;
  onAddBot?: () => void;
  onRemoveBot?: (id: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ gameId, players, isHost, onStart, onCopy, onAddBot, onRemoveBot }) => {
  const shareLink = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
  
  // Count real players vs bots
  const botCount = players.filter(p => p.isBot).length;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-700">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Lobby</h2>
            <div className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-sm border border-green-800">
                Online
            </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-6 flex items-center justify-between gap-4">
            <div className="truncate text-slate-400 flex-1">{shareLink}</div>
            <button 
                onClick={onCopy}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
                Copy Link
            </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {players.map(p => (
                <div key={p.id} className="relative bg-slate-700 p-4 rounded-lg flex flex-col items-center animate-fade-in group">
                    <img 
                        src={`https://ui-avatars.com/api/?name=${p.name}&background=${p.isBot ? '6366f1' : 'random'}&color=fff&rounded=true`} 
                        alt={p.name}
                        className="w-16 h-16 rounded-full mb-2 shadow-md"
                    />
                    <span className="text-white font-semibold flex items-center gap-1">
                      {p.name}
                      {p.isBot && <span className="bg-indigo-500 text-[10px] px-1 rounded uppercase">Bot</span>}
                    </span>
                    {p.isHost && <span className="text-yellow-500 text-xs uppercase font-bold mt-1">Host</span>}
                    
                    {isHost && p.isBot && onRemoveBot && (
                      <button 
                        onClick={() => onRemoveBot(p.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold"
                        title="Remove Bot"
                      >
                        ×
                      </button>
                    )}
                </div>
            ))}
            {players.length < 6 && Array.from({ length: 6 - players.length }).map((_, i) => (
                <div key={i} className="bg-slate-700/30 border-2 border-dashed border-slate-600 p-4 rounded-lg flex flex-col items-center justify-center opacity-50">
                    <div className="w-16 h-16 rounded-full bg-slate-800 mb-2"></div>
                    <span className="text-slate-500 text-sm">Waiting...</span>
                </div>
            ))}
        </div>

        <div className="flex flex-col gap-3">
            {isHost && players.length < 6 && (
                <button 
                  onClick={onAddBot}
                  className="w-full py-3 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors border border-indigo-500"
                >
                  + Add Bot
                </button>
            )}

            {isHost ? (
                <button 
                    onClick={onStart}
                    disabled={players.length < 2}
                    className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white text-xl font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {players.length < 2 ? 'Need at least 2 players' : 'Start Game'}
                </button>
            ) : (
                <div className="w-full py-4 bg-slate-700 text-slate-300 text-center rounded-lg font-semibold animate-pulse">
                    Waiting for host to start...
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
