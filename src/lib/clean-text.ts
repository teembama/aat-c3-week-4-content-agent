/**
 * Strips markdown so text can be pasted or emailed as-is.
 *
 * Lives apart from channel-adaptation.ts (which pulls in the Anthropic SDK) so
 * client components can import it without dragging the SDK into the browser
 * bundle.
 */
export function cleanForPlatform(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")                  // remove **bold**
    .replace(/\*(.+?)\*/g, "$1")                      // remove *italic*
    .replace(/^#{1,3}\s+/gm, "")                      // remove markdown headings
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")   // [text](url) -> text (url)
    .trim();
}
