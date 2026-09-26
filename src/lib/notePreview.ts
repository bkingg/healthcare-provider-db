/** One-line preview of a note for its collapsed card: the lines that carry
 * content — headings and empty template bullets left out — joined with
 * " · ". E.g. "## Call details\n- Spoke with: Awa\n- Duration: 6 min" →
 * "Spoke with: Awa · Duration: 6 min". */
export function notePreview(body: string): string {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,3}\s/.test(line))
    .map((line) => line.replace(/^[-•*]\s?/, "").trim())
    .filter(Boolean)
    .join(" · ");
}
