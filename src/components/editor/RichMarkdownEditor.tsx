import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Link as LinkIcon, Table as TableIcon,
  Undo, Redo, Minus, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// gfm-like tables
const td = new TurndownService({
  headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-",
});
td.addRule("tableCell", {
  filter: ["th", "td"],
  replacement: (content, node: any) => {
    const idx = Array.from(node.parentNode.childNodes).indexOf(node);
    return (idx === 0 ? "| " : " | ") + content.replace(/\n/g, " ").trim();
  },
});
td.addRule("tableRow", {
  filter: "tr",
  replacement: (content, node: any) => {
    const isHeader = node.parentNode.nodeName === "THEAD" ||
      Array.from(node.childNodes).some((n: any) => n.nodeName === "TH");
    const cells = Array.from(node.childNodes).filter((n: any) => n.nodeName === "TH" || n.nodeName === "TD").length;
    const sep = isHeader ? "\n|" + " --- |".repeat(cells) : "";
    return "\n" + content + " |" + sep;
  },
});
td.addRule("table", {
  filter: "table",
  replacement: (content) => "\n\n" + content.trim() + "\n\n",
});

marked.setOptions({ gfm: true, breaks: false });

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}

export function RichMarkdownEditor({ value, onChange, editable = true, placeholder, className }: Props) {
  const lastEmitted = useRef<string>(value);

  const initialHtml = useMemo(() => marked.parse(value || "") as string, []); // eslint-disable-line

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: "rounded-md bg-muted/50 p-3 text-xs" } } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "border-collapse w-full my-3" } }),
      TableRow, TableCell.configure({ HTMLAttributes: { class: "border border-border p-2 align-top" } }),
      TableHeader.configure({ HTMLAttributes: { class: "border border-border bg-muted/40 p-2 text-left font-semibold" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-accent underline" } }),
      Placeholder.configure({ placeholder: placeholder || "Start writing…" }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none px-4 py-3 min-h-[500px]",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = td.turndown(html);
      lastEmitted.current = md;
      onChange(md);
    },
  });

  // Sync when value changes from outside (e.g. selecting a different doc)
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    editor.commands.setContent(marked.parse(value || "") as string, { emitUpdate: false });
    lastEmitted.current = value;
  }, [value, editor]);

  useEffect(() => { editor?.setEditable(editable); }, [editable, editor]);

  if (!editor) return null;

  const ToolbarBtn = ({
    onClick, active, disabled, children, title,
  }: { onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded transition-colors",
        "hover:bg-accent/10 hover:text-accent disabled:opacity-40",
        active && "bg-accent/15 text-accent",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/20 px-2 py-1.5 sticky top-0 z-10 backdrop-blur">
          <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-3.5 w-3.5" /></ToolbarBtn>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarBtn title="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></ToolbarBtn>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-3.5 w-3.5" /></ToolbarBtn>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={() => {
            const prev = editor.getAttributes("link").href;
            const url = window.prompt("URL", prev || "https://");
            if (url === null) return;
            if (url === "") editor.chain().focus().unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}><LinkIcon className="h-3.5 w-3.5" /></ToolbarBtn>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarBtn title="Insert 3×3 table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          {editor.isActive("table") && (
            <>
              <ToolbarBtn title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus className="h-3.5 w-3.5" /></ToolbarBtn>
              <ToolbarBtn title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}><Minus className="h-3.5 w-3.5" /></ToolbarBtn>
              <ToolbarBtn title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Plus className="h-3.5 w-3.5 rotate-90" />
              </ToolbarBtn>
              <ToolbarBtn title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Minus className="h-3.5 w-3.5 rotate-90" />
              </ToolbarBtn>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => editor.chain().focus().deleteTable().run()}>
                Delete table
              </Button>
            </>
          )}
        </div>
      )}
      <div className="max-h-[640px] overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
