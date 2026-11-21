import React, { useRef, useEffect } from 'react';

interface ComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  webResearch: boolean;
  setWebResearch: (active: boolean) => void;
  attachedFile: File | null;
  setAttachedFile: (file: File | null) => void;
  onShowToast: (msg: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  webResearch,
  setWebResearch,
  attachedFile,
  setAttachedFile,
  onShowToast,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) {
        onStop();
      } else if (input.trim() || attachedFile) {
        onSend();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      onShowToast('File size must be under 15MB.');
      e.target.value = '';
      return;
    }

    setAttachedFile(file);
    onShowToast(`Attached ${file.name}`);
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <footer className="composer-area">
      <div className="composer-wrap">
        {attachedFile && (
          <div className="attachment-preview">
            <i className="fa-regular fa-file-lines"></i>
            <span>
              {attachedFile.name}{' '}
              <small>({(attachedFile.size / 1024 / 1024).toFixed(2)} MB)</small>
            </span>
            <button
              onClick={handleRemoveAttachment}
              aria-label="Remove attachment"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        <div className="composer-box">
          <textarea
            ref={textareaRef}
            className="message-textarea"
            rows={1}
            placeholder="Message NUSA AI..."
            aria-label="Message NUSA AI"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="composer-toolbar">
            <div className="composer-tools">
              <button
                type="button"
                className="tool-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach document or code"
              >
                <i className="fa-solid fa-paperclip"></i>
                <span>Attach</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".txt,.pdf,.py,.js,.ts,.json,.md,.html,.css,.png,.jpg"
                onChange={handleFileChange}
              />

              <span className="tool-divider"></span>

              <button
                type="button"
                className={`tool-btn ${webResearch ? 'active' : ''}`}
                onClick={() => {
                  const nextState = !webResearch;
                  setWebResearch(nextState);
                  onShowToast(
                    nextState
                      ? 'Web Research synthesis enabled'
                      : 'Web Research disabled'
                  );
                }}
                title="Toggle Web Research mode"
              >
                <i className="fa-solid fa-globe"></i>
                <span>Web research</span>
                <span className="toggle-switch"></span>
              </button>
            </div>

            <div className="composer-right">
              <span className="input-hint">
                Enter to send <kbd>↵</kbd>
              </span>

              {isStreaming ? (
                <button
                  type="button"
                  className="send-btn"
                  onClick={onStop}
                  title="Stop generating"
                  style={{ background: '#f87171', color: '#170b0b' }}
                >
                  <i className="fa-solid fa-stop"></i>
                </button>
              ) : (
                <button
                  type="button"
                  className="send-btn"
                  onClick={onSend}
                  disabled={!input.trim() && !attachedFile}
                  title="Send message"
                >
                  <i className="fa-solid fa-arrow-up"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="disclaimer">
          <i className="fa-solid fa-shield-halved"></i>
          NUSA AI responses are saved to SQLite database. Memory facts are tracked for persistent personalization.
        </div>
      </div>
    </footer>
  );
};
