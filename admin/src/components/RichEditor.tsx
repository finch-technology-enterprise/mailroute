import { useEditor, EditorContent, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { motion } from "motion/react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className="editor-btn"
      style={{
        background: active ? "rgba(0, 113, 227, 0.1)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        border: "none",
        borderRadius: "var(--radius-sm)",
        padding: "4px 8px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        minHeight: 32,
      }}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {label}
    </motion.button>
  );
}

export default function RichEditor({
  content,
  onChange,
  placeholder,
  minHeight = 280,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: content as Content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "apple-input",
        style: `min-height:${minHeight}px; padding:14px; font-size:15px; line-height:1.7; font-family:var(--font-sans); outline:none; cursor:text; border:none; border-radius:0;`,
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          background: "var(--bg-primary)",
        }}
      >
        <ToolbarButton
          label="B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="H1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          label="H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="H3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <ToolbarButton
          label="• List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="1. List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarButton
          label="Code block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <ToolbarButton
          label="—"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>
      <div onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .tiptap p { margin: 0 0 0.5em; }
        .tiptap h1, .tiptap h2, .tiptap h3 { margin: 0.75em 0 0.3em; }
        .tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap blockquote {
          border-left: 3px solid var(--border-hover);
          padding-left: 1em;
          margin: 0.5em 0;
          color: var(--text-secondary);
          font-style: italic;
        }
        .tiptap code {
          background: var(--border);
          border-radius: 3px;
          padding: 2px 5px;
          font-size: 0.9em;
          font-family: "SF Mono", monospace;
        }
        .tiptap pre {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px;
          margin: 0.5em 0;
          overflow-x: auto;
        }
        .tiptap pre code { background: none; padding: 0; }
        .tiptap hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
        .tiptap:focus { outline: none; }
        .tiptap p.is-editor-empty:first-child::before {
          color: var(--text-tertiary);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
