export const tweetButtonStyles = `
  .market-widget {
    padding: 12px 16px;
    background: #000000;
    border-bottom: none;
    margin-bottom: 4px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1000;
  }

  :host {
    display: block;
    width: 100%;
    position: relative;
    z-index: 1000;
  }

  .market-question {
    color: #e7e9ea;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 12px;
    font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 20px;
  }

  .button-row {
    display: flex;
    gap: 12px;
  }

  .bet-button {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-radius: 9999px;
    background: transparent;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .bet-button.yes {
    border: 1.5px solid #22c55e;
    color: #22c55e;
  }

  .bet-button.yes:hover {
    background: rgba(34, 197, 94, 0.15);
  }

  .bet-button.no {
    border: 1.5px solid #ef4444;
    color: #ef4444;
  }

  .bet-button.no:hover {
    background: rgba(239, 68, 68, 0.15);
  }

  .percentage {
    font-weight: 600;
  }

  /* ── Trade Modal ─────────────────────────────────────────────────────────── */

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 99999;
    padding-bottom: 0;
  }

  .modal {
    background: #15202b;
    border-radius: 16px 16px 0 0;
    padding: 20px 20px 28px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: slideUp 0.2s ease-out;
    font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    color: #e7e9ea;
    font-size: 17px;
    font-weight: 700;
  }

  .close-button {
    background: none;
    border: none;
    color: #71767b;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 50%;
    line-height: 1;
    transition: background 0.15s;
  }

  .close-button:hover {
    background: rgba(255,255,255,0.08);
  }

  .modal-question {
    color: #e7e9ea;
    font-size: 15px;
    font-weight: 400;
    line-height: 20px;
  }

  .picked-side {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .picked-label {
    color: #71767b;
    font-size: 14px;
  }

  .picked-badge {
    font-size: 14px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 9999px;
  }

  .picked-badge.yes {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .picked-badge.no {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .amount-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    color: #71767b;
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preset-row {
    display: flex;
    gap: 8px;
  }

  .preset-button {
    flex: 1;
    padding: 8px 0;
    border-radius: 9999px;
    border: 1.5px solid #2f3336;
    background: transparent;
    color: #e7e9ea;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .preset-button:hover {
    border-color: #0072ff;
    background: rgba(0, 114, 255, 0.08);
  }

  .preset-button.active {
    border-color: #0072ff;
    background: rgba(0, 114, 255, 0.15);
    color: #0072ff;
  }

  .custom-input-row {
    display: flex;
    align-items: center;
    border: 1.5px solid #2f3336;
    border-radius: 12px;
    padding: 10px 14px;
    gap: 8px;
    transition: border-color 0.15s;
  }

  .custom-input-row:focus-within {
    border-color: #0072ff;
  }

  .amount-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #e7e9ea;
    font-size: 18px;
    font-weight: 600;
    font-family: inherit;
    min-width: 0;
  }

  .amount-input::placeholder {
    color: #2f3336;
  }

  .currency-label {
    color: #71767b;
    font-size: 14px;
    font-weight: 500;
  }

  .payout-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(255,255,255,0.04);
    border-radius: 12px;
  }

  .payout-label {
    color: #71767b;
    font-size: 14px;
  }

  .payout-value {
    color: #e7e9ea;
    font-size: 16px;
    font-weight: 700;
  }

  .confirm-button {
    padding: 14px;
    border-radius: 9999px;
    border: none;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
    font-family: inherit;
  }

  .confirm-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .confirm-button.yes {
    background: #22c55e;
    color: #000;
  }

  .confirm-button.yes:not(:disabled):hover {
    opacity: 0.85;
  }

  .confirm-button.no {
    background: #ef4444;
    color: #fff;
  }

  .confirm-button.no:not(:disabled):hover {
    opacity: 0.85;
  }

  /* ── Wallet Gate ──────────────────────────────────────────────────────────── */

  .wallet-gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 0;
    text-align: center;
  }

  .wallet-gate-message {
    color: #e7e9ea;
    font-size: 15px;
    font-weight: 500;
    margin: 0;
  }

  .wallet-gate-hint {
    color: #71767b;
    font-size: 13px;
    margin: 0;
  }

  .wallet-address-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
  }

  .wallet-address-label {
    color: #71767b;
    font-size: 13px;
  }

  .wallet-address-value {
    color: #22c55e;
    font-size: 13px;
    font-weight: 600;
    font-family: monospace;
  }
`;
