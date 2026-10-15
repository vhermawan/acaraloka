"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { confirmEventImage, createEventImageUpload } from "@/actions/organizer-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_IMAGE_CONTENT_TYPES, validateEventImageFile } from "@/lib/event-image";
import { DESCRIPTION_MAX_IMAGES, countDescriptionImages, descriptionToHtml } from "@/lib/rich-text";
import { cn } from "cn";

type RichTextEditorProps = {
  id: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
};

type ToolbarButtonProps = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const IMAGE_ACCEPT = Object.keys(EVENT_IMAGE_CONTENT_TYPES).join(",");
const LINK_PATTERN = /^(?:https?:\/\/|mailto:)\S+$/i;

function ToolbarButton({ label, icon: Icon, active = false, disabled, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-lg"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

function ToolbarSeparator() {
  return <span role="separator" aria-orientation="vertical" className="mx-1 hidden h-5 w-px bg-border sm:block" />;
}

function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      link: current.isActive("link"),
      alignLeft: current.isActive({ textAlign: "left" }) || !current.getAttributes("paragraph").textAlign,
      alignCenter: current.isActive({ textAlign: "center" }),
      alignRight: current.isActive({ textAlign: "right" }),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const state = useToolbarState(editor);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const chain = () => editor.chain().focus();

  function openLink() {
    setLinkValue(editor.isActive("link") ? String(editor.getAttributes("link").href ?? "") : "");
    setLinkOpen(true);
  }

  function applyLink() {
    const raw = linkValue.trim();
    if (!raw) {
      chain().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    if (!LINK_PATTERN.test(href)) {
      toast.error("Tautan harus diawali https://, http://, atau mailto:.");
      return;
    }
    chain().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }

  async function uploadImage(file: File) {
    const invalid = validateEventImageFile(file.type, file.size);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (countDescriptionImages(editor.getHTML()) >= DESCRIPTION_MAX_IMAGES) {
      toast.error(`Maksimal ${DESCRIPTION_MAX_IMAGES} gambar di deskripsi.`);
      return;
    }

    setUploading(true);
    try {
      const signed = await createEventImageUpload({ contentType: file.type, size: file.size });
      if ("error" in signed) throw new Error(signed.error);

      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const response = await fetch(signed.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
      if (!response.ok) throw new Error("Upload gambar gagal. Coba lagi.");

      const confirmed = await confirmEventImage(signed.path);
      if ("error" in confirmed) throw new Error(confirmed.error);

      editor.chain().focus().setImage({ src: confirmed.url, alt: "" }).run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload gambar gagal. Coba lagi.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-input p-1.5">
      <div role="toolbar" aria-label="Format deskripsi" className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton label="Tebal" icon={Bold} active={state.bold} disabled={disabled} onClick={() => chain().toggleBold().run()} />
        <ToolbarButton label="Miring" icon={Italic} active={state.italic} disabled={disabled} onClick={() => chain().toggleItalic().run()} />
        <ToolbarButton label="Garis bawah" icon={UnderlineIcon} active={state.underline} disabled={disabled} onClick={() => chain().toggleUnderline().run()} />
        <ToolbarButton label="Coret" icon={Strikethrough} active={state.strike} disabled={disabled} onClick={() => chain().toggleStrike().run()} />
        <ToolbarSeparator />
        <ToolbarButton label="Judul bagian" icon={Heading2} active={state.h2} disabled={disabled} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="Sub judul" icon={Heading3} active={state.h3} disabled={disabled} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
        <ToolbarSeparator />
        <ToolbarButton label="Daftar berpoin" icon={List} active={state.bulletList} disabled={disabled} onClick={() => chain().toggleBulletList().run()} />
        <ToolbarButton label="Daftar bernomor" icon={ListOrdered} active={state.orderedList} disabled={disabled} onClick={() => chain().toggleOrderedList().run()} />
        <ToolbarButton label="Kutipan" icon={Quote} active={state.blockquote} disabled={disabled} onClick={() => chain().toggleBlockquote().run()} />
        <ToolbarSeparator />
        <ToolbarButton label="Rata kiri" icon={AlignLeft} active={state.alignLeft} disabled={disabled} onClick={() => chain().setTextAlign("left").run()} />
        <ToolbarButton label="Rata tengah" icon={AlignCenter} active={state.alignCenter} disabled={disabled} onClick={() => chain().setTextAlign("center").run()} />
        <ToolbarButton label="Rata kanan" icon={AlignRight} active={state.alignRight} disabled={disabled} onClick={() => chain().setTextAlign("right").run()} />
        <ToolbarSeparator />
        <ToolbarButton label="Tautan" icon={Link2} active={state.link || linkOpen} disabled={disabled} onClick={openLink} />
        <ToolbarButton
          label={uploading ? "Mengunggah gambar" : "Sisipkan gambar"}
          icon={ImagePlus}
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
        />
        <ToolbarSeparator />
        <ToolbarButton label="Urungkan" icon={Undo2} disabled={disabled || !state.canUndo} onClick={() => chain().undo().run()} />
        <ToolbarButton label="Ulangi" icon={Redo2} disabled={disabled || !state.canRedo} onClick={() => chain().redo().run()} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadImage(file);
        }}
      />
      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="url"
            inputMode="url"
            aria-label="Alamat tautan"
            placeholder="https://contoh.com"
            className="h-10 min-w-0 flex-1"
            value={linkValue}
            autoFocus
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
          />
          <Button type="button" className="h-10 px-3" onClick={applyLink}>
            Terapkan
          </Button>
          <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setLinkOpen(false)}>
            Batal
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RichTextEditor({ id, label, value, onChange, onBlur, invalid = false, disabled = false }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: false, defaultProtocol: "https" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false }),
    ],
    content: descriptionToHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: "rich-text min-h-48 px-3 py-2.5 text-base outline-none md:text-sm",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
    onBlur: () => onBlur?.(),
  });

  useEffect(() => {
    if (editor && editor.isEditable === disabled) editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    editor?.view.dom.setAttribute("aria-invalid", String(invalid));
  }, [editor, invalid]);

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        invalid && "border-destructive ring-3 ring-destructive/20 focus-within:border-destructive dark:border-destructive/50 dark:ring-destructive/40",
        disabled && "opacity-60",
      )}
    >
      {editor ? <Toolbar editor={editor} disabled={disabled} /> : <div className="h-12 border-b border-input" />}
      <EditorContent editor={editor} />
    </div>
  );
}

export { RichTextEditor };
