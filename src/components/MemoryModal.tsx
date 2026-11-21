import React from 'react';
import { MemoryFact } from '../types';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: MemoryFact[];
  onDeleteFact: (factId: string) => void;
  onClearMemory: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  facts,
  onDeleteFact,
  onClearMemory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-kicker">NUSA AI MEMORY MANAGEMENT</span>
            <h2>Active Conversation Memory</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <p>
          NUSA AI dynamically extracts key facts (e.g. your name, project stack, preferences) and injects them into multi-turn conversations so you never have to repeat yourself.
        </p>

        {facts.length === 0 ? (
          <div className="memory-empty-box text-center py-8 px-3 bg-[#0c1322] rounded-xl border border-[rgba(160,177,207,0.1)]">
            <i className="fa-solid fa-brain text-3xl mb-2 text-[#566885]"></i>
            <h4 className="text-sm font-medium text-[#d9e5f9] mb-1">
              No Memory Facts Extracted Yet
            </h4>
            <p className="text-xs text-[#7d8fa9] max-w-xs mx-auto">
              Tell NUSA AI things like &ldquo;My name is Alex&rdquo; or &ldquo;I am building a React app&rdquo; and it will automatically remember.
            </p>
          </div>
        ) : (
          <div className="memory-facts-list">
            {facts.map((fact) => (
              <div key={fact.id} className="memory-fact-item">
                <div className="memory-fact-content">
                  <strong>{fact.fact_key.replace(/_/g, ' ')}</strong>
                  <span>{fact.fact_value}</span>
                </div>
                <button
                  className="icon-btn tiny text-[#8d9eb8] hover:text-[#ff7878]"
                  title="Remove memory fact"
                  onClick={() => onDeleteFact(fact.id)}
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions mt-4">
          {facts.length > 0 && (
            <button
              className="secondary-btn text-[#ff8080] border-[rgba(255,100,100,0.3)] hover:bg-[rgba(255,100,100,0.1)]"
              onClick={onClearMemory}
            >
              Clear All Memory
            </button>
          )}
          <button className="primary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
