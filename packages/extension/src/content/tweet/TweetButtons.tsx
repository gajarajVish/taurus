import React, { useState } from 'react';
import type { Market } from '@taurus/types';
import { TradeModal } from './TradeModal';

interface TweetButtonsProps {
  tweetId: string;
  market: Market;
}

export function TweetButtons({ tweetId, market }: TweetButtonsProps) {
  const [modalSide, setModalSide] = useState<'YES' | 'NO' | null>(null);

  const yesPct = Math.round(parseFloat(market.yesPrice) * 100);
  const noPct = Math.round(parseFloat(market.noPrice) * 100);

  const handleClick = (e: React.MouseEvent, side: 'YES' | 'NO') => {
    e.preventDefault();
    e.stopPropagation();
    setModalSide(side);
  };

  return (
    <div
      className="market-widget"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="market-question">{market.question}</div>
      <div className="button-row">
        <button
          className="bet-button yes"
          onClick={(e) => handleClick(e, 'YES')}
        >
          <span>Yes</span>
          <span className="percentage">{yesPct}%</span>
        </button>
        <button
          className="bet-button no"
          onClick={(e) => handleClick(e, 'NO')}
        >
          <span>No</span>
          <span className="percentage">{noPct}%</span>
        </button>
      </div>

      {modalSide && (
        <TradeModal
          market={market}
          side={modalSide}
          onClose={() => setModalSide(null)}
        />
      )}
    </div>
  );
}
