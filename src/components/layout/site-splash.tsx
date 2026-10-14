'use client';

import './site-splash.css';

/** Animated brand identity rendered only while an App Router segment loads. */
export function SiteSplash() {
  return (
    <div className="bv-loader" role="status" aria-live="polite" aria-label="BetVima is loading">
      <div className="bv-loader__ambient" aria-hidden="true" />
      <div className="bv-loader__grid" aria-hidden="true" />
      <div className="bv-loader__body">
        <div className="bv-loader__orbit" aria-hidden="true">
          <span className="bv-loader__ring bv-loader__ring--outer" />
          <span className="bv-loader__ring bv-loader__ring--inner" />
          <span className="bv-loader__core">
            <img src="/brand/betvima-logo-transparent.png" alt=""
              width={170} height={78} className="bv-loader__logo" />
          </span>
        </div>
        <span className="bv-loader__eyebrow">THE GAME. ELEVATED.</span>
        <div className="bv-loader__track" aria-hidden="true">
          <span className="bv-loader__glide" />
        </div>
        <span className="bv-loader__note">PREPARING YOUR EXPERIENCE</span>
      </div>
    </div>
  );
}
