import { LinkifiedText } from "@/components/linkified-text";
import { splitMentions } from "@/lib/mentions";

/** People a note mentions, keyed by the handle as it was typed (lowercase):
 * shown as tags with their current handle; your own is highlighted. */
export type NoteMentions = Record<string, { handle: string; label: string; isMe: boolean }>;

function Line({ text, mentions }: { text: string; mentions?: NoteMentions }) {
  if (!mentions || !Object.keys(mentions).length) return <LinkifiedText text={text} />;
  return (
    <>
      {splitMentions(text).map((part, i) => {
        if ("text" in part) return <LinkifiedText key={i} text={part.text} />;
        const who = mentions[part.handle];
        if (!who) return part.raw;
        return (
          <span
            key={i}
            title={who.label}
            className={`px-0.5 font-semibold ${who.isMe ? "bg-[#fde68a] text-[#78350f] outline outline-1 outline-[#d97706]" : "bg-[#e0ecff] text-[#1d4ed8]"}`}
          >
            @{who.handle}
          </span>
        );
      })}
    </>
  );
}

/** Note text with the light structure note templates use: "## " (or "# ")
 * lines as headings and "- " / "• " lines as bullet points; everything else
 * as plain paragraphs, with links clickable. Only those line patterns are
 * interpreted — never HTML — so nothing a user types can inject markup.
 * Empty bullets left over from a template ("- ") are dropped. */
export function FormattedNote({ text, mentions }: { text: string; mentions?: NoteMentions }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="m-0 flex list-disc flex-col gap-0.5 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>
              <Line text={b} mentions={mentions} />
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-•*]\s?(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push(
        <p key={`h-${blocks.length}`} className="m-0 mt-1 text-[11.5px] font-bold tracking-[0.04em] text-pn-gray-1 uppercase first:mt-0">
          {heading[1]}
        </p>,
      );
    } else if (bullet) {
      if (bullet[1].trim()) bullets.push(bullet[1]);
    } else if (line.trim()) {
      flush();
      blocks.push(
        <p key={`p-${blocks.length}`} className="m-0">
          <Line text={line} mentions={mentions} />
        </p>,
      );
    } else {
      flush();
    }
  }
  flush();
  return <div className="flex flex-col gap-1 break-words">{blocks}</div>;
}
