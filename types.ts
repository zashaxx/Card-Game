export enum Suit {
  Spades = 'S',
  Hearts = 'H',
  Diamonds = 'D',
  Clubs = 'C'
}

export enum Rank {
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
  Two = 15 // Highest value in game logic
}

export interface CardData {
  id: string; // Unique ID for React keys
  suit: Suit;
  rank: Rank;
}

export enum HandType {
  Single = 'SINGLE',
  Pair = 'PAIR',
  Triple = 'TRIPLE', // Trail
  Sequence = 'SEQUENCE', // Rummy/Run
  Reset = 'RESET'
}

export interface PlayedHand {
  cards: CardData[];
  type: HandType;
  playerId: string;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean; 
  handCount: number; 
  hand?: CardData[]; 
  isFinished: boolean;
  rank: number | null; 
  lastAction?: 'PLAY' | 'PASS' | null; // For UI Feedback
}

export enum GameStatus {
  Lobby = 'LOBBY',
  Shuffling = 'SHUFFLING', // New Animation State
  Dealing = 'DEALING',
  Playing = 'PLAYING',
  RoundOver = 'ROUND_OVER',
  GameOver = 'GAME_OVER'
}

export interface GameState {
  players: Player[];
  currentPlayerId: string | null;
  lastLoserId: string | null; 
  pile: PlayedHand | null; 
  status: GameStatus;
  deck: CardData[]; 
  winners: string[];
  turnDeadline?: number; 
}

// Network Events
export interface NetworkMessage {
  type: 'JOIN' | 'START_GAME' | 'GAME_STATE_UPDATE' | 'PLAY_CARDS' | 'PASS' | 'LEAVE';
  payload: any;
}