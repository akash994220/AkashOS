import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Terminal } from 'lucide-react';

interface RichNoteRendererProps {
  content: string;
  onToggleChecklist?: (lineIndex: number) => void;
  className?: string;
  fontSize?: 'xs' | 'sm' | 'base';
}

import { LinkWithPreview } from './LinkWithPreview';
import { tokenizeTextWithLinks } from '../../lib/linkUtils';

/**
 * Parses and renders inline markdown: **bold**, *italic*, `code`, and [links](url),
 * plus raw web links with rich hover previews.
 */
function renderInlineFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  // Tokenize regex for **bold**, *italic*, `code`, and [link](url)
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Bold
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-zinc-900">
          {renderInlineFormattedText(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} className="italic text-zinc-800">
          {renderInlineFormattedText(part.slice(1, -1))}
        </em>
      );
    }

    // Inline Code
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-zinc-100 text-pink-600 font-mono text-[0.88em] border border-zinc-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Markdown Links [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      return (
        <LinkWithPreview
          key={i}
          url={linkUrl}
          variant="inline"
          className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8] cursor-pointer"
          stopPropagation={true}
        >
          {linkText}
        </LinkWithPreview>
      );
    }

    // Plain text: Tokenize any raw URLs so they are unconditionally blue and clickable
    const urlTokens = tokenizeTextWithLinks(part);
    if (urlTokens.some((t) => t.type === 'link')) {
      return (
        <React.Fragment key={i}>
          {urlTokens.map((token, subIdx) =>
            token.type === 'link' && token.url ? (
              <LinkWithPreview
                key={`${token.url}-${subIdx}`}
                url={token.url}
                domain={token.domain}
                path={token.path}
                variant="inline"
                className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8] cursor-pointer"
                stopPropagation={true}
              >
                {token.content}
              </LinkWithPreview>
            ) : (
              <span key={subIdx}>{token.content}</span>
            )
          )}
        </React.Fragment>
      );
    }

    return <span key={i}>{part}</span>;
  });
}

/**
 * Copyable Code Block component
 */
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 font-mono shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-zinc-400" />
          <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white px-2 py-0.5 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 text-xs overflow-x-auto leading-relaxed text-emerald-300/90 selection:bg-emerald-800 selection:text-white">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Rich Note Renderer: Transforms headings, bullet points, checklists, quotes, and code into a polished visual experience
 */
export const RichNoteRenderer: React.FC<RichNoteRendererProps> = ({
  content,
  onToggleChecklist,
  className = '',
  fontSize = 'sm',
}) => {
  if (!content.trim()) {
    return (
      <div className="p-6 text-center text-zinc-400 text-xs italic">
        Note is empty. Paste formatted text from AI chat, Word, or web pages, or start writing!
      </div>
    );
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inCode = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  let tableBuffer: string[] = [];

  const flushTable = (keyPrefix: number) => {
    if (!tableBuffer.length) return;
    const rows = tableBuffer.map((r) =>
      r
        .split('|')
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    );
    tableBuffer = [];

    if (!rows.length) return;
    const header = rows[0];
    const dataRows = rows.slice(1).filter((r) => !r.every((cell) => /^[-:]+$/.test(cell)));

    renderedElements.push(
      <div key={`tbl-${keyPrefix}`} className="my-3 overflow-x-auto rounded-xl border border-zinc-200 shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200">
            <tr>
              {header.map((col, idx) => (
                <th key={idx} className="px-3 py-2">
                  {renderInlineFormattedText(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70 bg-white">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-zinc-50/60 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 text-zinc-800">
                    {renderInlineFormattedText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    // Code fence start/end
    if (trimmed.startsWith('```')) {
      if (inCode) {
        // flush code block
        inCode = false;
        renderedElements.push(
          <CodeBlock key={`code-${idx}`} code={codeBuffer.join('\n')} language={codeLang} />
        );
        codeBuffer = [];
        codeLang = '';
      } else {
        // start code block
        if (tableBuffer.length) flushTable(idx);
        inCode = true;
        codeLang = trimmed.slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Markdown Table Line
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      tableBuffer.push(trimmed);
      continue;
    } else if (tableBuffer.length) {
      flushTable(idx);
    }

    // Blank line
    if (!trimmed) {
      renderedElements.push(<div key={`sp-${idx}`} className="h-2.5" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h1
          key={`h1-${idx}`}
          className="text-xl sm:text-2xl font-black text-zinc-950 pt-3.5 pb-1 border-b border-zinc-200 tracking-tight"
        >
          {renderInlineFormattedText(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2
          key={`h2-${idx}`}
          className="text-lg sm:text-xl font-extrabold text-zinc-900 pt-2.5 pb-0.5 tracking-tight"
        >
          {renderInlineFormattedText(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3
          key={`h3-${idx}`}
          className="text-base sm:text-lg font-bold text-zinc-800 pt-2 pb-0.5 tracking-tight"
        >
          {renderInlineFormattedText(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('#### ') || trimmed.startsWith('##### ') || trimmed.startsWith('###### ')) {
      const headingLevel = trimmed.indexOf(' ');
      renderedElements.push(
        <h4
          key={`h4-${idx}`}
          className="text-sm sm:text-base font-bold text-zinc-700 pt-1.5 pb-0.5 uppercase tracking-wide text-xs"
        >
          {renderInlineFormattedText(trimmed.slice(headingLevel + 1))}
        </h4>
      );
      continue;
    }

    // Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      renderedElements.push(<hr key={`hr-${idx}`} className="my-3 border-zinc-200" />);
      continue;
    }

    // Interactive Checklists: [ ] or [x]
    const uncheckedMatch = rawLine.match(/^(\s*)(?:[-*•]\s+)?\[ \]\s*(.*)$/);
    if (uncheckedMatch) {
      const indentCount = Math.min(Math.floor(uncheckedMatch[1].length / 2), 4);
      renderedElements.push(
        <div
          key={`chk-u-${idx}`}
          onClick={() => onToggleChecklist && onToggleChecklist(idx)}
          style={{ paddingLeft: `${indentCount * 1.25}rem` }}
          className={`flex items-start gap-2.5 py-1 px-2 rounded-lg hover:bg-zinc-100/80 transition-colors group select-none ${
            onToggleChecklist ? 'cursor-pointer' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={false}
            readOnly
            className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
          />
          <span className="text-sm text-zinc-800 leading-snug flex-1">
            {renderInlineFormattedText(uncheckedMatch[2])}
          </span>
        </div>
      );
      continue;
    }

    const checkedMatch = rawLine.match(/^(\s*)(?:[-*•]\s+)?\[[xX]\]\s*(.*)$/);
    if (checkedMatch) {
      const indentCount = Math.min(Math.floor(checkedMatch[1].length / 2), 4);
      renderedElements.push(
        <div
          key={`chk-c-${idx}`}
          onClick={() => onToggleChecklist && onToggleChecklist(idx)}
          style={{ paddingLeft: `${indentCount * 1.25}rem` }}
          className={`flex items-start gap-2.5 py-1 px-2 rounded-lg hover:bg-zinc-100/80 transition-colors group select-none ${
            onToggleChecklist ? 'cursor-pointer' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={true}
            readOnly
            className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
          />
          <span className="text-sm text-zinc-400 line-through leading-snug flex-1">
            {renderInlineFormattedText(checkedMatch[2])}
          </span>
        </div>
      );
      continue;
    }

    // Bullet Points: •, -, *, etc.
    const bulletMatch = rawLine.match(/^(\s*)([•\-\*–—])\s+(.*)$/);
    if (bulletMatch) {
      const indentCount = Math.min(Math.floor(bulletMatch[1].length / 2), 4);
      renderedElements.push(
        <div
          key={`blt-${idx}`}
          style={{ paddingLeft: `${indentCount * 1.25 + 0.5}rem` }}
          className="flex items-start gap-2.5 py-0.5"
        >
          <span className="text-blue-600 font-bold select-none text-base leading-tight mt-0.5">•</span>
          <span className="text-sm text-zinc-800 leading-relaxed flex-1">
            {renderInlineFormattedText(bulletMatch[3])}
          </span>
        </div>
      );
      continue;
    }

    // Numbered Lists: 1. , 2.
    const numberMatch = rawLine.match(/^(\s*)(\d+)[\.\)]\s+(.*)$/);
    if (numberMatch) {
      const indentCount = Math.min(Math.floor(numberMatch[1].length / 2), 4);
      renderedElements.push(
        <div
          key={`num-${idx}`}
          style={{ paddingLeft: `${indentCount * 1.25 + 0.5}rem` }}
          className="flex items-start gap-2 py-0.5"
        >
          <span className="text-blue-600 font-bold text-xs min-w-[20px] select-none pt-0.5">
            {numberMatch[2]}.
          </span>
          <span className="text-sm text-zinc-800 leading-relaxed flex-1">
            {renderInlineFormattedText(numberMatch[3])}
          </span>
        </div>
      );
      continue;
    }

    // Blockquote: > ...
    if (trimmed.startsWith('> ')) {
      renderedElements.push(
        <blockquote
          key={`bq-${idx}`}
          className="border-l-4 border-blue-500 pl-3.5 py-1.5 my-1.5 text-sm text-zinc-700 italic bg-blue-50/50 rounded-r-xl"
        >
          {renderInlineFormattedText(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Standard Paragraph text
    renderedElements.push(
      <p key={`p-${idx}`} className="text-sm text-zinc-800 leading-relaxed">
        {renderInlineFormattedText(rawLine)}
      </p>
    );
  }

  // Flush any lingering tables or code
  if (tableBuffer.length) flushTable(lines.length);
  if (inCode && codeBuffer.length) {
    renderedElements.push(
      <CodeBlock key="code-end" code={codeBuffer.join('\n')} language={codeLang} />
    );
  }

  const sizeClasses = fontSize === 'xs' ? 'text-xs' : fontSize === 'base' ? 'text-base' : 'text-sm';

  return <div className={`space-y-1 font-sans ${sizeClasses} ${className}`}>{renderedElements}</div>;
};
