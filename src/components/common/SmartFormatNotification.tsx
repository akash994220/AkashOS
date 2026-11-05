import React from 'react';
import { Sparkles, X, Check, ArrowRight, RotateCcw, FileText, Bot, Globe, BookOpen } from 'lucide-react';
import { FormattedDetectionResult } from '../../lib/smartFormatDetector';

interface SmartFormatNotificationProps {
  detection: FormattedDetectionResult;
  onApplyTitle?: (title: string) => void;
  onRevertToRaw?: () => void;
  onDismiss: () => void;
  showRawToggle?: boolean;
  isUsingRaw?: boolean;
}

export const SmartFormatNotification: React.FC<SmartFormatNotificationProps> = ({
  detection,
  onApplyTitle,
  onRevertToRaw,
  onDismiss,
  showRawToggle = true,
  isUsingRaw = false,
}) => {
  const { source, sourceLabel, stats, suggestedTitle } = detection;

  const getSourceIcon = () => {
    switch (source) {
      case 'ai_chat':
        return <Bot className="w-4 h-4 text-violet-600" />;
      case 'word_doc':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'google_docs':
        return <BookOpen className="w-4 h-4 text-emerald-600" />;
      case 'web_article':
        return <Globe className="w-4 h-4 text-cyan-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  const statItems: string[] = [];
  if (stats.headingsCount > 0) statItems.push(`${stats.headingsCount} ${stats.headingsCount === 1 ? 'Headline' : 'Headlines'}`);
  if (stats.bulletsCount > 0) statItems.push(`${stats.bulletsCount} Points`);
  if (stats.numberedCount > 0) statItems.push(`${stats.numberedCount} Numbered`);
  if (stats.checklistCount > 0) statItems.push(`${stats.checklistCount} Checklists`);
  if (stats.codeBlocksCount > 0) statItems.push(`${stats.codeBlocksCount} Code`);
  if (stats.tablesCount > 0) statItems.push(`${stats.tablesCount} Table`);

  return (
    <div className="mx-2 sm:mx-4 my-2 p-2.5 sm:p-3 rounded-xl border border-blue-200/90 bg-gradient-to-r from-blue-50/95 via-indigo-50/80 to-purple-50/90 shadow-sm text-xs text-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-white shadow-2xs shrink-0 mt-0.5">
            {getSourceIcon()}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-zinc-900 flex items-center gap-1">
                <span>Format Detected:</span>
                <span className="text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                  {sourceLabel}
                </span>
              </span>
              {statItems.length > 0 && (
                <span className="text-zinc-500 text-[11px] font-medium hidden sm:inline">
                  ({statItems.join(' • ')})
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-600 leading-snug">
              {isUsingRaw
                ? 'Showing unformatted raw text. Click "Apply Formatted" to structure points and headings.'
                : 'Preserved headlines, bullet points, numbers, bold text & lists cleanly.'}
            </p>

            {suggestedTitle && onApplyTitle && (
              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-zinc-500">Detected Title:</span>
                <button
                  type="button"
                  onClick={() => onApplyTitle(suggestedTitle)}
                  className="font-semibold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 transition-colors cursor-pointer text-[11px] flex items-center gap-1 shadow-2xs max-w-xs truncate"
                  title="Use detected title for this note"
                >
                  <span className="truncate">"{suggestedTitle}"</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showRawToggle && onRevertToRaw && (
            <button
              type="button"
              onClick={onRevertToRaw}
              className="text-[11px] font-medium px-2 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-zinc-500" />
              <span>{isUsingRaw ? 'Apply Formatted' : 'Keep Raw'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-white/80 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
