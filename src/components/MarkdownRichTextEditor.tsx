'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRegisterShortcutScope, useShortcutSettings } from '@/components/ShortcutProvider';
import { formatShortcutCombo } from '@/lib/shortcut-settings';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';

type EditorMode = 'markdown' | 'richtext' | 'live';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyInlineMarkdown(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function markdownToRichTextHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${applyInlineMarkdown(paragraph.join('<br />'))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listBuffer) return;
    blocks.push(`<${listBuffer.type}>${listBuffer.items.map(item => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</${listBuffer.type}>`);
    listBuffer = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote><p>${applyInlineMarkdown(quote[1])}</p></blockquote>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(ordered[1]);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(unordered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.join('');
}

function collapseMarkdownWhitespace(value: string) {
  return value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function editorHtmlToMarkdown(html: string) {
  if (!html.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';

  const serializeInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof HTMLElement)) return '';

    const children = Array.from(node.childNodes).map(serializeInline).join('');
    const tag = node.tagName.toLowerCase();

    if (tag === 'strong' || tag === 'b') return `**${children}**`;
    if (tag === 'em' || tag === 'i') return `*${children}*`;
    if (tag === 'del' || tag === 's') return `~~${children}~~`;
    if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${children}\``;
    if (tag === 'a') {
      const href = node.getAttribute('href')?.trim();
      return href ? `[${children || href}](${href})` : children;
    }
    if (tag === 'br') return '\n';
    return children;
  };

  const serializeBlock = (node: Node, depth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim();
    if (!(node instanceof HTMLElement)) return '';

    const tag = node.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      return `${'#'.repeat(level)} ${Array.from(node.childNodes).map(serializeInline).join('').trim()}`;
    }

    if (tag === 'p' || tag === 'div') {
      return Array.from(node.childNodes).map(serializeInline).join('').trim();
    }

    if (tag === 'blockquote') {
      const inner = Array.from(node.childNodes).map(child => serializeBlock(child, depth + 1)).join('\n').trim();
      return inner.split('\n').filter(Boolean).map(line => `> ${line}`).join('\n');
    }

    if (tag === 'ul') {
      return Array.from(node.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
        .map(li => `${'  '.repeat(depth)}- ${Array.from(li.childNodes).map(serializeInline).join('').trim()}`)
        .join('\n');
    }

    if (tag === 'ol') {
      return Array.from(node.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
        .map((li, index) => `${'  '.repeat(depth)}${index + 1}. ${Array.from(li.childNodes).map(serializeInline).join('').trim()}`)
        .join('\n');
    }

    if (tag === 'pre') {
      const code = node.textContent ?? '';
      return `\`\`\`\n${code.trimEnd()}\n\`\`\``;
    }

    return Array.from(node.childNodes).map(serializeInline).join('').trim();
  };

  const blocks = Array.from(root.childNodes)
    .map(node => serializeBlock(node))
    .filter(Boolean);

  return collapseMarkdownWhitespace(blocks.join('\n\n'));
}

function MilkdownInner({
  initialBody,
  onBodyChange,
  minHeight,
}: {
  initialBody: string;
  onBodyChange: (v: string) => void;
  minHeight: number;
}) {
  const onChangeRef = useRef(onBodyChange);
  onChangeRef.current = onBodyChange;
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialBody);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(listener),
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const pm = wrapperRef.current?.querySelector('.ProseMirror');
      if (pm) pm.classList.add('md-body');
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="milkdown-live-wrapper p-4"
      style={{ minHeight, backgroundColor: 'white', color: 'var(--text-primary)' }}
    >
      <Milkdown />
    </div>
  );
}

const TOOLBAR_BUTTON_STYLE = 'px-2.5 py-1.5 text-xs rounded-lg border transition-colors';

function ToolbarButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={TOOLBAR_BUTTON_STYLE}
      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'white' }}
    >
      {label}
    </button>
  );
}

export function MarkdownRichTextEditor({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSave,
  onCancel,
  isDirty = false,
  saveLabel = '保存',
  titlePlaceholder = 'タイトル',
  bodyLabel = '内容',
  minHeight = 220,
}: {
  title?: string;
  body: string;
  onTitleChange?: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isDirty?: boolean;
  saveLabel?: string;
  titlePlaceholder?: string;
  bodyLabel?: string;
  minHeight?: number;
}) {
  const [mode, setMode] = useState<EditorMode>('richtext');
  const [richTextHtml, setRichTextHtml] = useState(() => markdownToRichTextHtml(body));
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastBodyRef = useRef(body);
  const shortcutScopeId = useId();
  const { settings } = useShortcutSettings();

  useEffect(() => {
    if (body === lastBodyRef.current) return;
    lastBodyRef.current = body;
    const nextHtml = markdownToRichTextHtml(body);
    setRichTextHtml(nextHtml);
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [body]);

  useEffect(() => {
    if (mode === 'richtext' && editorRef.current && editorRef.current.innerHTML !== richTextHtml) {
      editorRef.current.innerHTML = richTextHtml;
    }
  }, [mode, richTextHtml]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useRegisterShortcutScope(shortcutScopeId, 'Markdownエディタ', {
    save_current: isDirty ? onSave : undefined,
  });

  const previewHint = useMemo(() => {
    if (mode === 'markdown') return 'Markdown記法で直接編集します。';
    if (mode === 'richtext') return '装飾を使って編集し、保存時はMarkdownに変換します。';
    return 'Markdownを入力すると即座に整形されます。';
  }, [mode]);

  const syncFromEditor = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    setRichTextHtml(html);
    const markdown = editorHtmlToMarkdown(html);
    lastBodyRef.current = markdown;
    onBodyChange(markdown);
  }, [onBodyChange]);

  const execEditorCommand = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  }, [syncFromEditor]);

  const insertLink = useCallback(() => {
    const url = window.prompt('リンク先URLを入力してください');
    if (!url) return;
    execEditorCommand('createLink', url);
  }, [execEditorCommand]);

  return (
    <div className="space-y-3">
      {onTitleChange && (
        <input
          className="field-input text-sm font-semibold"
          placeholder={titlePlaceholder}
          value={title ?? ''}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="field-label mb-0">{bodyLabel}</label>
          <div className="flex items-center gap-2 text-xs">
            {isDirty && (
              <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(215,138,29,0.1)', color: '#b66a10' }}>
                未保存の変更あり
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>{previewHint}</span>
            <span style={{ color: 'var(--text-muted)' }}>{settings.save_current.enabled ? `${formatShortcutCombo(settings.save_current.combo)} で保存` : '保存ショートカットOFF'}</span>
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(241,250,252,0.68)' }}>
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'richtext', label: 'リッチテキスト' },
                { key: 'markdown', label: 'Markdown' },
                { key: 'live', label: 'ライブ' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMode(tab.key)}
                  className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                  style={mode === tab.key
                    ? { backgroundColor: 'white', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.18)' }
                    : { color: 'var(--text-muted)' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {mode === 'richtext' && (
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton label="見出し" onClick={() => execEditorCommand('formatBlock', 'h2')} />
                <ToolbarButton label="太字" onClick={() => execEditorCommand('bold')} />
                <ToolbarButton label="斜体" onClick={() => execEditorCommand('italic')} />
                <ToolbarButton label="箇条書き" onClick={() => execEditorCommand('insertUnorderedList')} />
                <ToolbarButton label="番号" onClick={() => execEditorCommand('insertOrderedList')} />
                <ToolbarButton label="引用" onClick={() => execEditorCommand('formatBlock', 'blockquote')} />
                <ToolbarButton label="リンク" onClick={insertLink} />
                <ToolbarButton label="クリア" onClick={() => execEditorCommand('removeFormat')} />
              </div>
            )}
          </div>

          {mode === 'live' ? (
            <MilkdownProvider>
              <MilkdownInner
                initialBody={body}
                onBodyChange={(v) => {
                  lastBodyRef.current = v;
                  onBodyChange(v);
                }}
                minHeight={minHeight}
              />
            </MilkdownProvider>
          ) : mode === 'markdown' ? (
            <textarea
              className="w-full p-4 text-sm resize-none focus:outline-none"
              style={{ minHeight, color: 'var(--text-primary)', backgroundColor: 'white', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.7 }}
              placeholder="Markdownで記述できます"
              value={body}
              onChange={(e) => {
                lastBodyRef.current = e.target.value;
                onBodyChange(e.target.value);
                setRichTextHtml(markdownToRichTextHtml(e.target.value));
              }}
            />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="p-4 focus:outline-none md-body"
              style={{ minHeight, backgroundColor: 'white', color: 'var(--text-primary)' }}
              onInput={syncFromEditor}
              onBlur={syncFromEditor}
            />
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            if (isDirty && !window.confirm('未保存の変更があります。保存せずに閉じますか？')) return;
            onCancel();
          }}
          className="btn-secondary text-sm"
        >
          キャンセル
        </button>
        <button type="button" onClick={onSave} className="btn-primary text-sm">{saveLabel}</button>
      </div>
    </div>
  );
}
