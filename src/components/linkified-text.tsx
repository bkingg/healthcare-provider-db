import { splitLinks } from "@/lib/linkify";

/** Message text with web links made clickable (see lib/linkify.ts). Links
 * open in a new tab and don't pass on where the reader came from. Keeps line
 * breaks when the parent uses `whitespace-pre-line`. */
export function LinkifiedText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.type === "text" ? (
          part.text
        ) : (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={part.href}
            className={`font-semibold break-all text-[#0a5c3c] underline underline-offset-2 ${className}`}
          >
            {part.text}
          </a>
        ),
      )}
    </>
  );
}
