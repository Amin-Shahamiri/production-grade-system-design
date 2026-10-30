const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFakeModel({ delayMs = 0 } = {}) {
  return {
    async summarize(text) {
      if (delayMs > 0) await sleep(delayMs);
      const words = text.trim().split(/\s+/);
      return {
        summary: `FAKE SUMMARY (${words.length} words): ${words.slice(0, 12).join(' ')}`,
        modelId: 'fake',
        usage: { inputTokens: words.length, outputTokens: 20 },
      };
    },
  };
}