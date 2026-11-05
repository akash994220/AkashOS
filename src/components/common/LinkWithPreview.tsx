import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Copy, Check, Globe, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { extractDomain, extractPath, getFaviconUrl, normalizeUrl } from '../../lib/linkUtils';

interface LinkWithPreviewProps {
  url: string;
  displayText?: string;
  domain?: string;
  path?: string;
  className?: string;
  children?: React.ReactNode;
  variant?: 'inline' | 'capsule' | 'badge';
  stopPropagation?: boolean;
}

export const LinkWithPreview: React.FC<LinkWithPreviewProps> = ({
  url,
  displayText,
  domain: initialDomain,
  path: initialPath,
  className = '',
  children,
  variant = 'inline',
  stopPropagation = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const triggerRef = useRef<HTMLAnchorElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullUrl = normalizeUrl(url);
  const domain = initialDomain || extractDomain(fullUrl);
  const path = initialPath !== undefined ? initialPath : extractPath(fullUrl);
  const faviconUrl = getFaviconUrl(domain);
  const isHttps = fullUrl.startsWith('https://');

  const updateCardPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardWidth = 320;
    const cardHeight = 160;
    const gap = 8;

    // Check vertical space (flip above if close to bottom of screen)
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: 'top' | 'bottom' = spaceBelow < cardHeight + gap && rect.top > cardHeight + gap ? 'top' : 'bottom';

    let top = placement === 'bottom' ? rect.bottom + gap : rect.top - cardHeight - gap;
    // Align horizontally with clamp
    let left = rect.left;
    if (left + cardWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - cardWidth - 16);
    }
    if (left < 16) {
      left = 16;
    }

    setCoords({ top, left, placement });
  };

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    openTimerRef.current = setTimeout(() => {
      updateCardPosition();
      setIsOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleCardMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (stopPropagation) {
      e.stopPropagation();
    }
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
  };

  // Close preview on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  // Styling presets by variant - ALWAYS bold vibrant blue
  let variantStyles = 'text-[#2563eb] font-semibold underline decoration-[#3b82f6] hover:text-[#1d4ed8] hover:decoration-[#1d4ed8] transition-colors cursor-pointer';
  if (variant === 'capsule') {
    variantStyles = 'inline font-bold text-[#2563eb] hover:text-[#1d4ed8] underline decoration-[#3b82f6] hover:decoration-[#1d4ed8] transition-all cursor-pointer break-all';
  } else if (variant === 'badge') {
    variantStyles = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group/badge';
  }

  return (
    <>
      <a
        ref={triggerRef}
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ color: '#2563eb' }}
        className={`${variantStyles} ${className}`}
        title={`Open ${domain}`}
      >
        {children || displayText || domain}
      </a>

      {isOpen &&
        createPortal(
          <div
            ref={cardRef}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '320px',
              zIndex: 999999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="animate-in fade-in zoom-in-95 duration-150 rounded-2xl bg-zinc-950/95 text-white p-3.5 shadow-2xl border border-zinc-800 backdrop-blur-md select-none font-sans"
          >
            {/* Header: Favicon + Clean Domain + Protocol Badge */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/80">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-zinc-800/90 flex items-center justify-center shrink-0 overflow-hidden border border-zinc-700/60 shadow-inner">
                  {!faviconError && faviconUrl ? (
                    <img
                      src={faviconUrl}
                      alt={domain}
                      className="w-4 h-4 object-contain"
                      onError={() => setFaviconError(true)}
                    />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-100 truncate tracking-tight">
                    {domain}
                  </h4>
                </div>
              </div>

              {isHttps && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span>HTTPS</span>
                </div>
              )}
            </div>

            {/* Path / Full URL preview */}
            <div className="py-2.5">
              <div className="text-[11px] text-zinc-400 font-mono break-all line-clamp-2 leading-relaxed bg-zinc-900/80 p-2 rounded-xl border border-zinc-800/60">
                {fullUrl}
              </div>
            </div>

            {/* Actions: Open in New Tab & Copy Link */}
            <div className="flex items-center gap-2 pt-1">
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white text-zinc-950 text-xs font-bold hover:bg-zinc-100 transition-all shadow-sm cursor-pointer group"
              >
                <span>Open Link</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition-all cursor-pointer"
                title="Copy link to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default LinkWithPreview;
