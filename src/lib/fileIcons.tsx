import {
  FileText, FileCode2, FileJson, FileImage, FileArchive, FileSpreadsheet,
  FileTerminal, FileType2, File,
} from "lucide-react";

export type FileMeta = {
  icon: React.ReactNode;
  /** Monaco language id for the built-in editor */
  language: string;
  label: string;
};

const EXT_MAP: Record<string, { language: string; label: string; color: string; Icon: any }> = {
  md:    { language: "markdown",   label: "Markdown",   color: "text-violet-400",  Icon: FileText },
  mdx:   { language: "markdown",   label: "MDX",        color: "text-violet-400",  Icon: FileText },
  txt:   { language: "plaintext",  label: "Text",       color: "text-muted-foreground", Icon: FileType2 },
  ts:    { language: "typescript", label: "TypeScript", color: "text-cyan-400",    Icon: FileCode2 },
  tsx:   { language: "typescript", label: "TypeScript", color: "text-cyan-400",    Icon: FileCode2 },
  js:    { language: "javascript", label: "JavaScript", color: "text-amber-400",   Icon: FileCode2 },
  jsx:   { language: "javascript", label: "JavaScript", color: "text-amber-400",   Icon: FileCode2 },
  java:  { language: "java",       label: "Java",       color: "text-orange-400",  Icon: FileCode2 },
  py:    { language: "python",     label: "Python",     color: "text-emerald-400", Icon: FileCode2 },
  json:  { language: "json",       label: "JSON",       color: "text-yellow-400",  Icon: FileJson },
  yml:   { language: "yaml",       label: "YAML",       color: "text-yellow-300",  Icon: FileJson },
  yaml:  { language: "yaml",       label: "YAML",       color: "text-yellow-300",  Icon: FileJson },
  html:  { language: "html",       label: "HTML",       color: "text-rose-400",    Icon: FileCode2 },
  css:   { language: "css",        label: "CSS",        color: "text-sky-400",     Icon: FileCode2 },
  csv:   { language: "plaintext",  label: "CSV",        color: "text-emerald-300", Icon: FileSpreadsheet },
  xlsx:  { language: "plaintext",  label: "Spreadsheet",color: "text-emerald-300", Icon: FileSpreadsheet },
  pdf:   { language: "plaintext",  label: "PDF",        color: "text-red-400",     Icon: FileText },
  docx:  { language: "plaintext",  label: "Word",       color: "text-blue-400",    Icon: FileText },
  png:   { language: "plaintext",  label: "Image",      color: "text-pink-400",    Icon: FileImage },
  jpg:   { language: "plaintext",  label: "Image",      color: "text-pink-400",    Icon: FileImage },
  jpeg:  { language: "plaintext",  label: "Image",      color: "text-pink-400",    Icon: FileImage },
  svg:   { language: "xml",        label: "SVG",        color: "text-pink-300",    Icon: FileImage },
  zip:   { language: "plaintext",  label: "Archive",    color: "text-muted-foreground", Icon: FileArchive },
  log:   { language: "plaintext",  label: "Log",        color: "text-muted-foreground", Icon: FileTerminal },
  sh:    { language: "shell",      label: "Shell",      color: "text-lime-400",    Icon: FileTerminal },
  sql:   { language: "sql",        label: "SQL",        color: "text-indigo-400",  Icon: FileCode2 },
};

export function extOf(filename: string): string {
  const base = filename.split("/").pop() || filename;
  const parts = base.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function fileLanguage(filename: string): string {
  return EXT_MAP[extOf(filename)]?.language ?? "plaintext";
}

export function fileKindLabel(filename: string): string {
  return EXT_MAP[extOf(filename)]?.label ?? "File";
}

/** Renders the appropriate coloured icon for a filename. */
export function FileIcon({ name, className = "h-3.5 w-3.5" }: { name: string; className?: string }) {
  const meta = EXT_MAP[extOf(name)];
  const Icon = meta?.Icon ?? File;
  return <Icon className={`${className} ${meta?.color ?? "text-muted-foreground"} shrink-0`} />;
}
