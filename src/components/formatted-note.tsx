import { LinkifiedText } from "@/components/linkified-text";

/** Note text with the light structure note templates use: "## " (or "# ")
 * lines as headings and "- " / "• " lines as bullet points; everything else
 * as plain paragraphs, with links clickable. Only those line patterns are
 * interpreted — never HTML — so nothing a user types can inject markup.
 * Empty bullets left over from a template ("- ") are dropped. */
export function FormattedNote({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="m-0 flex list-disc flex-col gap-0.5 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>
              <LinkifiedText text={b} />
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
          <LinkifiedText text={line} />
        </p>,
      );
    } else {
      flush();
    }
  }
  flush();
  return <div className="flex flex-col gap-1 break-words">{blocks}</div>;
}
