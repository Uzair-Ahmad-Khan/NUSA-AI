import React from 'react';

interface MarkdownOptions {
  onCopyCode?: (code: string) => void;
}

export function renderFormattedMarkdown(text: string, options: MarkdownOptions = {}) {
  if (!text) return null;

  // Split into code blocks (```...```) and regular markdown text
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, partIdx) => {
    // 1. Handle Code Blocks
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).trim().split('\n');
      const lang = lines[0].trim();
      const code = (lang && !lines[0].includes(' ') ? lines.slice(1) : lines).join('\n');

      return (
        <div key={`code-${partIdx}`} className="my-3 relative group">
          <div className="code-header flex items-center justify-between px-3 py-1.5 rounded-t-lg border-t border-l border-r text-xs transition">
            <span>{lang || 'code'}</span>
            {options.onCopyCode && (
              <button
                type="button"
                className="text-[11px] transition flex items-center gap-1"
                onClick={() => options.onCopyCode!(code)}
              >
                <i className="fa-regular fa-copy"></i> Copy code
              </button>
            )}
          </div>
          <pre className="!mt-0 !rounded-t-none">
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    // 2. Handle Markdown Blocks: Headings, Lists, Blockquotes, Paragraphs
    const paragraphs = part.split(/\n{2,}/);

    return paragraphs.map((block, blockIdx) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return null;

      const lines = block.split('\n');

      // Check if this entire block is a single heading
      const headingMatch = trimmedBlock.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch && lines.length === 1) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();

        if (level === 1) {
          return (
            <h1 key={`h1-${partIdx}-${blockIdx}`} className="message-h1">
              {renderInlineTokens(headingText)}
            </h1>
          );
        }
        if (level === 2) {
          return (
            <h2 key={`h2-${partIdx}-${blockIdx}`} className="message-h2">
              {renderInlineTokens(headingText)}
            </h2>
          );
        }
        if (level === 3) {
          return (
            <h3 key={`h3-${partIdx}-${blockIdx}`} className="message-h3">
              {renderInlineTokens(headingText)}
            </h3>
          );
        }
        return (
          <h4 key={`h4-${partIdx}-${blockIdx}`} className="message-h4">
            {renderInlineTokens(headingText)}
          </h4>
        );
      }

      // Check if block is a List
      const isBulletList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
      if (isBulletList) {
        return (
          <ul key={`ul-${partIdx}-${blockIdx}`} className="message-ul">
            {lines.map((line, lIdx) => (
              <li key={lIdx}>
                {renderInlineTokens(line.replace(/^\s*[-*•]\s+/, ''))}
              </li>
            ))}
          </ul>
        );
      }

      const isOrderedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));
      if (isOrderedList) {
        return (
          <ol key={`ol-${partIdx}-${blockIdx}`} className="message-ol">
            {lines.map((line, lIdx) => (
              <li key={lIdx}>
                {renderInlineTokens(line.replace(/^\s*\d+\.\s+/, ''))}
              </li>
            ))}
          </ol>
        );
      }

      // Process line-by-line within the paragraph (handles lines with headings inside mixed paragraphs)
      return (
        <div key={`p-${partIdx}-${blockIdx}`} className="message-para my-2 leading-relaxed">
          {lines.map((line, lIdx) => {
            const lineTrim = line.trim();

            // Heading inside a paragraph
            const lineHeadingMatch = lineTrim.match(/^(#{1,6})\s+(.+)$/);
            if (lineHeadingMatch) {
              const level = lineHeadingMatch[1].length;
              const textOnly = lineHeadingMatch[2].trim();

              if (level === 1) {
                return (
                  <h1 key={lIdx} className="message-h1">
                    {renderInlineTokens(textOnly)}
                  </h1>
                );
              }
              if (level === 2) {
                return (
                  <h2 key={lIdx} className="message-h2">
                    {renderInlineTokens(textOnly)}
                  </h2>
                );
              }
              if (level === 3) {
                return (
                  <h3 key={lIdx} className="message-h3">
                    {renderInlineTokens(textOnly)}
                  </h3>
                );
              }
              return (
                <h4 key={lIdx} className="message-h4">
                  {renderInlineTokens(textOnly)}
                </h4>
              );
            }

            // Blockquote line
            if (lineTrim.startsWith('> ')) {
              return (
                <blockquote key={lIdx} className="message-blockquote">
                  {renderInlineTokens(lineTrim.slice(2))}
                </blockquote>
              );
            }

            // Normal text line
            return (
              <React.Fragment key={lIdx}>
                {renderInlineTokens(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            );
          })}
        </div>
      );
    });
  });
}

// Render bold, italics, inline code, and clean formatting
export function renderInlineTokens(text: string) {
  // Strip any accidental leading trailing hashes if not matched earlier
  const clean = text.replace(/^#{1,6}\s+/, '');
  const tokens = clean.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={idx}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2 && !token.startsWith('**')) {
      return <em key={idx}>{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return <code key={idx}>{token.slice(1, -1)}</code>;
    }
    return token;
  });
}
