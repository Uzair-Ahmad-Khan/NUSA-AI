import React from 'react';

interface WelcomeViewProps {
  onSelectPrompt: (prompt: string) => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onSelectPrompt }) => {
  return (
    <div className="welcome-view">
      <div className="welcome-hero-logo-wrap">
        <div className="hero-logo-ring ring-outer"></div>
        <div className="hero-logo-ring ring-inner"></div>
        <div className="hero-logo-badge">
          <img
            src="./logo.png"
            alt="NUSA AI Logo"
            className="hero-logo-img"
          />
        </div>
        <span className="orb-star star-a">✦</span>
        <span className="orb-star star-b">✧</span>
        <span className="orb-star star-c">·</span>
      </div>

      <div className="eyebrow">
        <span className="eyebrow-line"></span>
        YOUR INTELLIGENT AI ASSISTANT
        <span className="eyebrow-line"></span>
      </div>

      <h1>
        What can I help you<br />
        <span>create today?</span>
      </h1>

      <p className="welcome-subtitle">
        Think freely. Ask anything. With real-time WebSocket streaming, Python SQLite database, and contextual memory.
      </p>

      <div className="suggestion-grid">
        <button
          className="suggestion-card"
          onClick={() =>
            onSelectPrompt('Explain a complex topic in simple words, with an example.')
          }
        >
          <span className="suggestion-icon blue">
            <i className="fa-solid fa-graduation-cap"></i>
          </span>
          <span>
            <strong>Learn something</strong>
            <small>Break down a complex topic</small>
          </span>
          <i className="fa-solid fa-arrow-up-right-from-square suggestion-arrow"></i>
        </button>

        <button
          className="suggestion-card"
          onClick={() =>
            onSelectPrompt('Help me write clean, well-documented Python and TypeScript code.')
          }
        >
          <span className="suggestion-icon purple">
            <i className="fa-solid fa-code"></i>
          </span>
          <span>
            <strong>Write code</strong>
            <small>Build, debug, and understand architecture</small>
          </span>
          <i className="fa-solid fa-arrow-up-right-from-square suggestion-arrow"></i>
        </button>

        <button
          className="suggestion-card"
          onClick={() =>
            onSelectPrompt('Give me a clear step-by-step plan for building an AI-powered product.')
          }
        >
          <span className="suggestion-icon orange">
            <i className="fa-regular fa-compass"></i>
          </span>
          <span>
            <strong>Explore an idea</strong>
            <small>Turn thoughts into an actionable plan</small>
          </span>
          <i className="fa-solid fa-arrow-up-right-from-square suggestion-arrow"></i>
        </button>

        <button
          className="suggestion-card"
          onClick={() =>
            onSelectPrompt('Summarize and structure this question into key takeaways.')
          }
        >
          <span className="suggestion-icon green">
            <i className="fa-regular fa-file-lines"></i>
          </span>
          <span>
            <strong>Work with text</strong>
            <small>Summarize, rewrite, and analyze</small>
          </span>
          <i className="fa-solid fa-arrow-up-right-from-square suggestion-arrow"></i>
        </button>
      </div>
    </div>
  );
};
