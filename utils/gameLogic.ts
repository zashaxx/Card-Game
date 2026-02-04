import { CardData, HandType, PlayedHand, Rank, Suit } from "../types";

// Generate a standard deck
export const createDeck = (): CardData[] => {
  const deck: CardData[] = [];
  const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
  // 3 to 15 (2 is 15)
  const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  ranks.forEach(rank => {
    suits.forEach(suit => {
      deck.push({
        id: `${rank}-${suit}-${Math.random().toString(36).substr(2, 9)}`,
        rank: rank as Rank,
        suit: suit
      });
    });
  });
  return shuffle(deck);
};

const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Sort cards for hand display (Ascending)
export const sortCards = (cards: CardData[]): CardData[] => {
  return [...cards].sort((a, b) => {
    if (a.rank === b.rank) return a.suit.localeCompare(b.suit);
    return a.rank - b.rank;
  });
};

// Determine type of hand
export const identifyHandType = (cards: CardData[]): HandType | null => {
  const sorted = sortCards(cards);
  const len = sorted.length;
  
  // Single
  if (len === 1) return HandType.Single;

  // Check if all same rank (Pair / Triple)
  const allSameRank = sorted.every(c => c.rank === sorted[0].rank);

  // Pair
  if (len === 2 && allSameRank) return HandType.Pair;

  // Triple (Trail)
  if (len === 3 && allSameRank) return HandType.Triple;

  // Sequence (Run) - Must be SAME SUIT and STRICTLY 3 CARDS
  if (len === 3) {
    const firstSuit = sorted[0].suit;
    let isSequence = true;
    let isSameSuit = true;

    for (let i = 0; i < len - 1; i++) {
      if (sorted[i].suit !== firstSuit) {
        isSameSuit = false;
        break;
      }
      if (sorted[i + 1].rank !== sorted[i].rank + 1) {
        isSequence = false;
        break;
      }
    }
    
    if (isSequence && isSameSuit) return HandType.Sequence;
  }

  return null;
};

// Main Rule Logic
export const isValidMove = (
  selectedCards: CardData[],
  currentPile: PlayedHand | null,
  handLength: number
): { valid: boolean; isReset: boolean; message?: string } => {
  
  if (selectedCards.length === 0) return { valid: false, isReset: false, message: "No cards selected" };

  // Check for '2' logic (Reset Card)
  const twos = selectedCards.filter(c => c.rank === Rank.Two);
  const isAllTwos = twos.length === selectedCards.length;

  // Rule: Cannot end game on a 2
  if (isAllTwos && selectedCards.length === handLength) {
     return { valid: false, isReset: false, message: "Cannot finish with a 2" };
  }

  // Opening move (no pile)
  if (currentPile === null) {
    const type = identifyHandType(selectedCards);
    if (!type) return { valid: false, isReset: false, message: "Invalid combination" };
    if (isAllTwos) return { valid: true, isReset: true }; 
    return { valid: true, isReset: false };
  }

  const pileType = currentPile.type;
  
  // Reset Logic
  if (isAllTwos) {
    if ((pileType === HandType.Single || pileType === HandType.Pair) && selectedCards.length === 1) {
      return { valid: true, isReset: true };
    }
    if ((pileType === HandType.Triple || pileType === HandType.Sequence) && selectedCards.length === 2) {
      return { valid: true, isReset: true };
    }
    return { valid: false, isReset: false, message: "Incorrect number of '2's to reset this pile" };
  }

  // Strict Type Matching
  const handType = identifyHandType(selectedCards);
  if (handType !== pileType) {
    return { valid: false, isReset: false, message: `Must play a ${pileType}` };
  }

  // Sequence Rules
  if (handType === HandType.Sequence && selectedCards.length !== 3) {
      return { valid: false, isReset: false, message: "Sequence must be exactly 3 cards" };
  }

  const selectedMax = Math.max(...selectedCards.map(c => c.rank));
  const pileMax = Math.max(...currentPile.cards.map(c => c.rank));

  if (selectedMax > pileMax) {
    return { valid: true, isReset: false };
  }

  return { valid: false, isReset: false, message: "Must play higher value" };
};

// --- Bot Logic ---
const analyzeHand = (hand: CardData[]) => {
    const sorted = sortCards(hand);
    const nonTwos = sorted.filter(c => c.rank !== Rank.Two);
    const twos = sorted.filter(c => c.rank === Rank.Two);

    // Group by Rank
    const byRank: {[key: number]: CardData[]} = {};
    nonTwos.forEach(c => {
        if (!byRank[c.rank]) byRank[c.rank] = [];
        byRank[c.rank].push(c);
    });

    // Group by Suit
    const bySuit: {[key: string]: CardData[]} = {};
    nonTwos.forEach(c => {
        if (!bySuit[c.suit]) bySuit[c.suit] = [];
        bySuit[c.suit].push(c);
    });

    // Find Sequences (Strictly 3)
    const sequences: CardData[][] = [];
    Object.values(bySuit).forEach(suitCards => {
        if (suitCards.length < 3) return;
        
        for (let i = 0; i <= suitCards.length - 3; i++) {
             const sub = suitCards.slice(i, i+3);
             if (sub[1].rank === sub[0].rank + 1 && sub[2].rank === sub[1].rank + 1) {
                 sequences.push(sub);
                 i += 2;
             }
        }
    });

    // Find Triples
    const triples: CardData[][] = [];
    Object.values(byRank).forEach(cards => {
        if (cards.length >= 3) triples.push(cards.slice(0, 3));
    });

    // Find Pairs
    const pairs: CardData[][] = [];
    Object.values(byRank).forEach(cards => {
        if (cards.length >= 2) pairs.push(cards.slice(0, 2));
    });

    // Singles
    const singles = nonTwos.map(c => [c]);

    return { sequences, triples, pairs, singles, twos };
};

export const getBotMove = (hand: CardData[], pile: PlayedHand | null): { cards: CardData[], isReset: boolean } | null => {
  const analysis = analyzeHand(hand);
  
  // 1. LEADING (No Pile)
  if (!pile) {
    if (analysis.sequences.length > 0) return { cards: analysis.sequences[0], isReset: false };
    if (analysis.triples.length > 0) return { cards: analysis.triples[0], isReset: false };
    if (analysis.pairs.length > 0) return { cards: analysis.pairs[0], isReset: false };
    if (analysis.singles.length > 0) return { cards: analysis.singles[0], isReset: false };
    
    if (analysis.twos.length > 0) {
         if (analysis.twos.length > 1) return { cards: [analysis.twos[0]], isReset: true };
    }
    return null;
  }

  // 2. RESPONDING
  const pileMax = Math.max(...pile.cards.map(c => c.rank));

  // A. Try to beat naturally - STRICT TYPE MATCHING
  if (pile.type === HandType.Sequence) {
      for (const seq of analysis.sequences) {
          if (seq[2].rank > pileMax) {
              return { cards: seq, isReset: false };
          }
      }
  }
  else if (pile.type === HandType.Triple) {
      const candidate = analysis.triples.find(t => t[0].rank > pileMax);
      if (candidate) return { cards: candidate, isReset: false };
  }
  else if (pile.type === HandType.Pair) {
      const candidate = analysis.pairs.find(p => p[0].rank > pileMax);
      if (candidate) return { cards: candidate, isReset: false };
  }
  else if (pile.type === HandType.Single) {
      const candidate = analysis.singles.find(s => s[0].rank > pileMax);
      if (candidate) return { cards: candidate, isReset: false };
  }

  // B. Try to Reset with 2s
  const numTwosNeeded = (pile.type === HandType.Single || pile.type === HandType.Pair) ? 1 : 2;
  
  if (analysis.twos.length >= numTwosNeeded) {
      if (hand.length > numTwosNeeded) {
          return { cards: analysis.twos.slice(0, numTwosNeeded), isReset: true };
      }
  }

  return null;
};