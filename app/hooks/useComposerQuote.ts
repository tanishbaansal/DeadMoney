import { useEffect, useState } from "react";
import { getComposerQuote, type ComposerQuote, type ComposerQuoteParams } from "~/lib/composerApi";

export function useComposerQuote(params: ComposerQuoteParams | null) {
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params) {
      setQuote(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;

    async function fetch() {
      setStatus("loading");
      setError(null);
      try {
        const data = await getComposerQuote(params!);
        if (!cancelled) {
          setQuote(data);
          setStatus("done");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to get quote");
          setStatus("error");
        }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  return { quote, status, error };
}
