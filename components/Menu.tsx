import React, { useState } from 'react';

interface MenuProps {
  onHost: (name: string) => void;
  onJoin: (name: string, hostId: string) => void;
  isConnecting: boolean;
}

const Menu: React.FC<MenuProps> = ({ onHost, onJoin, isConnecting }) => {
  const [name, setName] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [mode, setMode] = useState<'main' | 'join'>('main');

  const handleHost = () => {
    if (!name) return alert("Enter your name");
    onHost(name);
  };

  const handleJoin = () => {
    if (!name) return alert("Enter your name");
    // Extract ID from link if full URL provided
    let hostId = joinLink;
    if (joinLink.includes('?game=')) {
        hostId = joinLink.split('?game=')[1];
    }
    if (!hostId) return alert("Invalid Game ID/Link");
    onJoin(name, hostId);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2 text-center">
          TYCOON CARDS
        </h1>
        <p className="text-slate-400 text-center mb-8">The Strategy Card Game</p>

        {mode === 'main' && (
          <div className="space-y-4">
            <div>
                <label className="block text-slate-300 mb-1 text-sm">Your Name</label>
                <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-yellow-500 outline-none"
                    placeholder="Player Name"
                />
            </div>
            
            <button 
                onClick={handleHost}
                disabled={isConnecting}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
                {isConnecting ? 'Starting...' : 'Host New Game'}
            </button>
            
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-sm">OR</span>
                <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <button 
                onClick={() => setMode('join')}
                className="w-full py-4 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600 transition-all"
            >
                Join Game
            </button>
          </div>
        )}

        {mode === 'join' && (
            <div className="space-y-4">
                <div>
                    <label className="block text-slate-300 mb-1 text-sm">Your Name</label>
                    <input 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="Player Name"
                    />
                </div>
                <div>
                    <label className="block text-slate-300 mb-1 text-sm">Game Link or ID</label>
                    <input 
                        value={joinLink}
                        onChange={(e) => setJoinLink(e.target.value)}
                        className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="Paste link here..."
                    />
                </div>
                
                <div className="flex gap-2 pt-2">
                    <button 
                        onClick={() => setMode('main')}
                        className="flex-1 py-3 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600 transition-all"
                    >
                        Back
                    </button>
                    <button 
                        onClick={handleJoin}
                        disabled={isConnecting}
                        className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-all disabled:opacity-50"
                    >
                        {isConnecting ? 'Joining...' : 'Join Game'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Menu;
