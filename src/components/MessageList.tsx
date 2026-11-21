import React from 'react';
import { Message } from '../types';
import { renderFormattedMarkdown } from '../utils/markdown';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  onCopy: (content: string) => void;
  onRegenerate: (index: number) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  streamingText,
  onCopy,
  onRegenerate,
}) => {
  return (
    <div className="messages-view">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';

        return (
          <article
            key={message.id || index}
            className={`message-row ${isUser ? 'user' : 'assistant'}`}
          >
            <div className={`message-avatar ${isUser ? 'user-avatar' : 'asst-logo-avatar'}`}>
              {isUser ? (
                <i className="fa-solid fa-user"></i>
              ) : (
                <img
                  src="./logo.png"
                  alt="NUSA AI"
                  className="message-avatar-logo"
                />
              )}
            </div>

            <div className="message-content">
              <div className="message-label">{isUser ? 'You' : 'NUSA AI'}</div>
              <div className="message-bubble">
                {renderFormattedMarkdown(message.content, { onCopyCode: onCopy })}
              </div>

              {!isUser && (
                <div className="message-actions">
                  <button
                    className="message-action"
                    onClick={() => onCopy(message.content)}
                    title="Copy response"
                  >
                    <i className="fa-regular fa-copy"></i> Copy
                  </button>
                  <button
                    className="message-action"
                    onClick={() => onRegenerate(index)}
                    title="Regenerate response"
                  >
                    <i className="fa-solid fa-rotate-right"></i> Regenerate
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}

      {/* Real-time Streaming message placeholder */}
      {isStreaming && (
        <article className="message-row assistant">
          <div className="message-avatar asst-logo-avatar">
            <img
              src="./logo.png"
              alt="NUSA AI"
              className="message-avatar-logo"
            />
          </div>
          <div className="message-content">
            <div className="message-label flex items-center gap-2">
              <span>NUSA AI</span>
              <span className="text-[10px] text-[#71b8ff] animate-pulse">Streaming live...</span>
            </div>
            <div className="message-bubble">
              {streamingText ? (
                renderFormattedMarkdown(streamingText, { onCopyCode: onCopy })
              ) : (
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  );
};
