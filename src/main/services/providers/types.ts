export interface ChatProviderAdapter {
  chatStream(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onChunk: (text: string) => void
  ): Promise<string>
}
