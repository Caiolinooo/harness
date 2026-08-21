import type { LanguageModelV1 } from "ai";

/**
 * Minimal LanguageModelV1 stub. Demo mode never calls into the network;
 * harness-core short-circuits before generateText/generateObject when demo=true.
 */
export function createMockLanguageModel(modelId: string): LanguageModelV1 {
  const unsupported = async () => {
    throw new Error(
      `Demo model "${modelId}" was invoked via AI SDK. ` +
        `Harness should short-circuit demo handles before provider calls.`,
    );
  };

  return {
    specificationVersion: "v1",
    provider: "harness-demo",
    modelId,
    defaultObjectGenerationMode: "json",
    doGenerate: unsupported,
    doStream: unsupported,
  } as LanguageModelV1;
}
