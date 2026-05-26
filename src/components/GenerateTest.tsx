import { useState } from "react";

export function GenerateTest() {
  const [prompt, setPrompt] = useState("List 10 essential items for a 3-day bikepacking trip in a tent.");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOutput("");
    setError(null);
    setElapsed(null);
    setStreaming(true);
    const start = Date.now();

    try {
      const response = await fetch("/api/generate/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        setError(`Error: ${response.status}`);
        return;
      }

      const reader = (response.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setElapsed(Date.now() - start);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-1 text-2xl font-bold">F-02: Streaming Test</h1>
      <p className="mb-4 text-sm text-gray-500">Tymczasowa strona weryfikacji. Zostanie usunięta w S-01.</p>
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
          }}
          rows={3}
          className="mb-2 w-full rounded border p-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={streaming}
          className="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
        >
          {streaming ? "Streaming…" : "Generate"}
        </button>
      </form>
      {elapsed !== null && <p className="mb-2 text-sm text-green-600">✓ Completed in {(elapsed / 1000).toFixed(1)}s</p>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <pre className="min-h-24 rounded bg-gray-100 p-4 font-mono text-sm whitespace-pre-wrap">
        {output || (streaming ? "▋" : "Output will appear here…")}
      </pre>
    </div>
  );
}
