import React from 'react';
import { CardData, Suit, Rank } from '../types';

interface CardProps {
  card: CardData;
  isSelected?: boolean;
  onClick?: () => void;
  small?: boolean;
  hidden?: boolean;
  index?: number; // for animation staggering
}

const Card: React.FC<CardProps> = ({ card, isSelected, onClick, small, hidden, index = 0 }) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;
  
  const getSuitIcon = (s: Suit) => {
    switch(s) {
      case Suit.Spades: return '♠';
      case Suit.Hearts: return '♥';
      case Suit.Diamonds: return '♦';
      case Suit.Clubs: return '♣';
    }
  };

  const getRankDisplay = (r: Rank) => {
    if (r <= 10) return r.toString();
    if (r === 11) return 'J';
    if (r === 12) return 'Q';
    if (r === 13) return 'K';
    if (r === 14) return 'A';
    if (r === 15) return '2';
    return '';
  };

  if (hidden) {
    return (
      <div 
        className={`
          relative bg-blue-800 border-2 border-white rounded-lg shadow-md
          ${small ? 'w-10 h-14' : 'w-20 h-28 sm:w-24 sm:h-36'}
          flex items-center justify-center
          background-pattern
        `}
      >
        <div className="w-full h-full opacity-20 bg-[radial-gradient(circle,_#ffffff_1px,_transparent_1px)] bg-[length:4px_4px]"></div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-lg shadow-md select-none cursor-pointer
        ${small ? 'w-10 h-14 text-xs' : 'w-20 h-28 sm:w-24 sm:h-36 text-lg sm:text-xl'}
        ${isRed ? 'text-red-600' : 'text-slate-900'}
        flex flex-col justify-between p-1 sm:p-2 border border-slate-300
        hover:brightness-95 transition-filter
      `}
    >
      {/* Top Corner */}
      <div className="flex flex-col items-center leading-none">
        <span className="font-bold">{getRankDisplay(card.rank)}</span>
        <span className="text-sm sm:text-base">{getSuitIcon(card.suit)}</span>
      </div>

      {/* Center Big Icon */}
      <div className="absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl opacity-20 pointer-events-none">
        {getSuitIcon(card.suit)}
      </div>

      {/* Bottom Corner (Rotated) */}
      <div className="flex flex-col items-center leading-none rotate-180">
        <span className="font-bold">{getRankDisplay(card.rank)}</span>
        <span className="text-sm sm:text-base">{getSuitIcon(card.suit)}</span>
      </div>
    </div>
  );
};

export default Card;