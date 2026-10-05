/** Prefer source text; an identifier remains a separate reference, never an invented topic. */
export function voteLabel(event: {
  context?: { pointHeading: string | null; reportTitle: string | null };
}) {
  return (
    event.context?.pointHeading || event.context?.reportTitle || 'Votering utan importerad rubrik'
  );
}
