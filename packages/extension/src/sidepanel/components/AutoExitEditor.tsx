import React, { useState, useEffect, useCallback } from 'react';
import { getAutoExitConfig, setAutoExitConfig, getAISettings, setAISettings, getInstallId } from '../../lib/storage';
import { api } from '../../lib/api';
import type { AutoExitConfig, AutoExitRule } from '@taurus/types';

const RULE_TYPE_LABELS: Record<AutoExitRule['type'], string> = {
  pnl_gain: 'Take Profit',
  pnl_loss: 'Stop Loss',
  risk_score: 'Risk Score',
  price_target: 'Price Target',
};

const RULE_TYPE_COLORS: Record<AutoExitRule['type'], string> = {
  pnl_gain: 'var(--color-success)',
  pnl_loss: 'var(--color-error)',
  risk_score: 'var(--color-warning)',
  price_target: 'var(--color-purple)',
};

export function AutoExitEditor() {
  const [config, setConfig] = useState<AutoExitConfig | null>(null);
  const [expanded, setExpanded] = useState(true);

  // AI Insights settings
  const [aiEnabled, setAiEnabled] = useState(true);
  const [minTweetCount, setMinTweetCount] = useState(1);
  const [minSentimentScore, setMinSentimentScore] = useState(0.4);

  useEffect(() => {
    getAutoExitConfig().then(setConfig);
    getAISettings().then((s) => {
      setAiEnabled(s.enabled);
      setMinTweetCount(s.minTweetCount);
      setMinSentimentScore(s.minSentimentScore);
    });
  }, []);

  const persist = useCallback(async (updated: AutoExitConfig) => {
    setConfig(updated);
    await setAutoExitConfig(updated);
    try {
      const installId = await getInstallId();
      await api.automation.updateConfig(installId, updated);
    } catch {
      // Backend sync is best-effort
    }
  }, []);

  if (!config) return null;

  // ── Auto-exit handlers ─────────────────────────────────────────────────────

  const toggleMaster = () => persist({ ...config, enabled: !config.enabled });

  const toggleRule = (ruleId: string) => {
    const rules = config.rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    persist({ ...config, rules });
  };

  const updateRuleThreshold = (ruleId: string, value: number) => {
    const rules = config.rules.map((r) =>
      r.id === ruleId ? { ...r, threshold: value } : r
    );
    persist({ ...config, rules });
  };

  const updateRuleAction = (ruleId: string, action: AutoExitRule['action']) => {
    const rules = config.rules.map((r) =>
      r.id === ruleId ? { ...r, action } : r
    );
    persist({ ...config, rules });
  };

  const removeRule = (ruleId: string) => {
    persist({ ...config, rules: config.rules.filter((r) => r.id !== ruleId) });
  };

  const addRule = () => {
    const newRule: AutoExitRule = {
      id: `rule-${Date.now()}`,
      type: 'pnl_gain',
      threshold: 0.25,
      action: 'exit_full',
      enabled: true,
    };
    persist({ ...config, rules: [...config.rules, newRule] });
  };

  const updateRuleType = (ruleId: string, type: AutoExitRule['type']) => {
    const defaultThresholds: Record<AutoExitRule['type'], number> = {
      pnl_gain: 0.20,
      pnl_loss: -0.15,
      risk_score: 0.85,
      price_target: 0.80,
    };
    const rules = config.rules.map((r) =>
      r.id === ruleId ? { ...r, type, threshold: defaultThresholds[type] } : r
    );
    persist({ ...config, rules });
  };

  const formatThreshold = (rule: AutoExitRule): string => {
    if (rule.type === 'price_target') return `${(rule.threshold * 100).toFixed(0)}¢`;
    return `${rule.threshold >= 0 ? '+' : ''}${(rule.threshold * 100).toFixed(0)}%`;
  };

  // ── AI Insights handlers ───────────────────────────────────────────────────

  const toggleAiEnabled = async () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    await setAISettings({ enabled: next });
  };

  const changeMinTweets = async (delta: number) => {
    const next = Math.max(1, Math.min(10, minTweetCount + delta));
    setMinTweetCount(next);
    await setAISettings({ minTweetCount: next });
  };

  const changeMinScore = async (delta: number) => {
    const next = Math.round(Math.max(0, Math.min(100, Math.round(minSentimentScore * 100) + delta)));
    setMinSentimentScore(next / 100);
    await setAISettings({ minSentimentScore: next / 100 });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeCount = [aiEnabled, config.enabled].filter(Boolean).length;

  return (
    <div className="ae-container">
      <div className="ae-header" onClick={() => setExpanded(!expanded)}>
        <div className="ae-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className="ae-title">AI Settings</span>
          {activeCount > 0 && (
            <span className="ae-badge ae-badge--active">
              {activeCount === 2 ? 'Insights · Auto-Exit' : aiEnabled ? 'Insights' : 'Auto-Exit'} ON
            </span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'var(--transition-fast)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {expanded && (
        <div className="ae-body">
          {/* ── AI Insights section ── */}
          <div className="ae-section">
            <span className="ae-section-title">AI Insights</span>

            <div className="ae-insight-row">
              <span className="ae-insight-label">Enabled</span>
              <button className={`ae-toggle ${aiEnabled ? 'ae-toggle--on' : ''}`} onClick={toggleAiEnabled}>
                <span className="ae-toggle-thumb" />
              </button>
            </div>

            {aiEnabled && (
              <>
                <div className="ae-insight-row">
                  <span className="ae-insight-label">Min Tweets</span>
                  <div className="ae-stepper">
                    <button className="ae-stepper-btn" onClick={() => changeMinTweets(-1)}>−</button>
                    <span className="ae-stepper-val">{minTweetCount}</span>
                    <button className="ae-stepper-btn" onClick={() => changeMinTweets(1)}>+</button>
                  </div>
                </div>
                <div className="ae-insight-row">
                  <span className="ae-insight-label">Min Confidence</span>
                  <div className="ae-stepper">
                    <button className="ae-stepper-btn" onClick={() => changeMinScore(-5)}>−</button>
                    <span className="ae-stepper-val">{Math.round(minSentimentScore * 100)}%</span>
                    <button className="ae-stepper-btn" onClick={() => changeMinScore(5)}>+</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Auto-Exit Rules section ── */}
          <div className="ae-section">
            <div className="ae-insight-row">
              <span className="ae-section-title">Auto-Exit Rules</span>
              <button
                className={`ae-toggle ${config.enabled ? 'ae-toggle--on' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleMaster(); }}
              >
                <span className="ae-toggle-thumb" />
              </button>
            </div>

            {config.rules.map((rule) => (
              <div key={rule.id} className={`ae-rule ${!rule.enabled ? 'ae-rule--disabled' : ''}`}>
                <div className="ae-rule-top">
                  <span className="ae-rule-dot" style={{ background: RULE_TYPE_COLORS[rule.type] }} />
                  <select
                    className="ae-rule-type"
                    value={rule.type}
                    onChange={(e) => updateRuleType(rule.id, e.target.value as AutoExitRule['type'])}
                  >
                    {Object.entries(RULE_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <span className="ae-rule-threshold">{formatThreshold(rule)}</span>
                  <button
                    className={`ae-rule-toggle ${rule.enabled ? 'ae-rule-toggle--on' : ''}`}
                    onClick={() => toggleRule(rule.id)}
                  >
                    <span className="ae-toggle-thumb" />
                  </button>
                  <button className="ae-rule-remove" onClick={() => removeRule(rule.id)} title="Remove rule">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="ae-rule-controls">
                  <input
                    type="range"
                    className="ae-slider"
                    min={rule.type === 'pnl_loss' ? -50 : 1}
                    max={rule.type === 'pnl_loss' ? -1 : 100}
                    step={1}
                    value={Math.round(rule.threshold * 100)}
                    onChange={(e) => updateRuleThreshold(rule.id, parseInt(e.target.value) / 100)}
                  />
                  <select
                    className="ae-action-select"
                    value={rule.action}
                    onChange={(e) => updateRuleAction(rule.id, e.target.value as AutoExitRule['action'])}
                  >
                    <option value="exit_full">Exit Full</option>
                    <option value="exit_half">Exit Half</option>
                  </select>
                </div>
              </div>
            ))}

            <button className="ae-add" onClick={addRule}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Rule
            </button>

            <p className="ae-hint">
              Guest: auto-executes &middot; Wallet: shows confirmation
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
