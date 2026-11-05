import React, { useRef, useState } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import { ContentTree, ContentCategory } from '../../../types/content';
import { exportTreeToJSON, parseTreeFromJSON, exportTreeToMarkdown } from './treeUtils';
import { 
  FolderTree, 
  FileText, 
  Download, 
  Upload, 
  Copy, 
  Trash2, 
  Check, 
  Plus, 
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
  X,
  FileCode,
  HardDrive
} from 'lucide-react';

interface TreeFileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trees: ContentTree[];
  activeTreeId: string | null;
  onSelectTree: (treeId: string) => void;
  onCreateNewTree: () => void;
  onDuplicateTree: (tree: ContentTree) => void;
  onDeleteTree: (treeId: string, title: string) => void;
  onImportTree: (tree: ContentTree) => void;
}

export const TreeFileManagerModal: React.FC<TreeFileManagerModalProps> = ({
  isOpen,
  onClose,
  trees,
  activeTreeId,
  onSelectTree,
  onCreateNewTree,
  onDuplicateTree,
  onDeleteTree,
  onImportTree,
}) => {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle local JSON file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const parsed = parseTreeFromJSON(content, trees[0]?.owner_uid || 'user');
      if (parsed) {
        onImportTree(parsed);
      } else {
        setImportError('Invalid Idea Tree JSON file. Please check format.');
      }
    };
    reader.onerror = () => setImportError('Failed to read file.');
    reader.readAsText(file);
    // Reset file input so user can re-upload same file
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadJSON = (tree: ContentTree) => {
    const jsonStr = exportTreeToJSON(tree);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (tree.title || 'idea_tree')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadSuccessId(tree.id);
    setTimeout(() => setDownloadSuccessId(null), 2500);
  };

  const handleCopyMarkdown = (tree: ContentTree) => {
    const md = exportTreeToMarkdown(tree);
    navigator.clipboard.writeText(md);
    setCopiedId(tree.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: theme.colors.borderLight,
        }}
        className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                Tree File Vault & Saved Projects
              </h2>
              <p className="text-xs text-zinc-500">
                All idea trees are auto-saved to cloud and can be exported as offline JSON or Markdown files.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Header: Import / New Tree */}
        <div className="px-5 py-3 border-b border-zinc-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-700">
              {trees.length} Saved {trees.length === 1 ? 'Tree' : 'Trees'}
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Real-time Cloud Sync</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden file input for uploading */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-semibold cursor-pointer transition-colors"
              title="Upload and restore a .json idea tree"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Import JSON File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateNewTree();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Tree</span>
            </button>
          </div>
        </div>

        {importError && (
          <div className="mx-5 my-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
            <span>{importError}</span>
            <button onClick={() => setImportError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        {/* Tree Files List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {trees.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 space-y-2">
              <FolderTree className="w-10 h-10 mx-auto text-zinc-300" />
              <p className="text-xs font-semibold">No saved idea trees found.</p>
            </div>
          ) : (
            trees.map((tree) => {
              const isActive = tree.id === activeTreeId;
              const formattedDate = new Date(tree.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={tree.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-indigo-50/60 border-indigo-300 shadow-xs ring-1 ring-indigo-400/30'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200'
                  }`}
                >
                  {/* Tree Info */}
                  <div 
                    onClick={() => {
                      onSelectTree(tree.id);
                      onClose();
                    }}
                    className="flex-1 min-w-0 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <FolderTree className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-700'}`} />
                      <h4 className="text-xs sm:text-sm font-bold text-zinc-900 truncate">
                        {tree.title || 'Untitled Tree'}
                      </h4>
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.2 rounded-full shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-400" />
                        <span>{tree.nodes.length} branches</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        <span>Saved {formattedDate}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions for this tree file */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Open Button */}
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTree(tree.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 cursor-pointer"
                      >
                        Open
                      </button>
                    )}

                    {/* Download JSON file */}
                    <button
                      type="button"
                      onClick={() => handleDownloadJSON(tree)}
                      className="p-1.5 px-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Save & Download .JSON file to computer"
                    >
                      {downloadSuccessId === tree.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden md:inline">JSON</span>
                    </button>

                    {/* Copy Markdown */}
                    <button
                      type="button"
                      onClick={() => handleCopyMarkdown(tree)}
                      className="p-1.5 px-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy as Markdown outline"
                    >
                      {copiedId === tree.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden md:inline">Text</span>
                    </button>

                    {/* Duplicate Tree */}
                    <button
                      type="button"
                      onClick={() => onDuplicateTree(tree)}
                      className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 cursor-pointer"
                      title="Duplicate as new tree file"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Tree */}
                    <button
                      type="button"
                      onClick={() => onDeleteTree(tree.id, tree.title)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 cursor-pointer"
                      title="Delete tree"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Tip: Export your trees as JSON to easily share with collaborators or backup offline.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white font-semibold cursor-pointer hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
