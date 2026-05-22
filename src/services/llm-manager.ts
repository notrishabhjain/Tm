import * as FileSystem from 'expo-file-system';

const LLM_FILENAME = 'taskmind_llm_model.gguf';
const MIN_SIZE_BYTES = 200_000_000; // 200 MB — rejects corrupt/partial files

// Legacy filenames from the old two-model architecture — migrated on first access
const LEGACY_FILENAMES = ['taskmind_qwen3_0.6b_q4km.gguf', 'taskmind_qwen3_1.7b_q4km.gguf'];

// Recommended models shown in the UI — user can import either
export const LLM_RECOMMENDED_MODELS = [
  {
    repo: 'bartowski/Qwen3-0.6B-GGUF',
    filename: 'Qwen3-0.6B-Q4_K_M.gguf',
    size: '~380 MB',
    note: 'Lighter, stays in RAM comfortably, good Hindi support',
  },
  {
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    size: '~650 MB',
    note: 'Stronger English extraction, better on complex cases',
  },
];

export function getLlmModelPath(): string {
  return `${FileSystem.documentDirectory ?? ''}${LLM_FILENAME}`;
}

async function migrateFromLegacy(): Promise<boolean> {
  const destPath = getLlmModelPath();
  for (const legacy of LEGACY_FILENAMES) {
    const legacyPath = `${FileSystem.documentDirectory ?? ''}${legacy}`;
    try {
      const info = await FileSystem.getInfoAsync(legacyPath);
      if (
        info.exists &&
        'size' in info &&
        typeof info.size === 'number' &&
        info.size >= MIN_SIZE_BYTES
      ) {
        await FileSystem.moveAsync({ from: legacyPath, to: destPath });
        return true;
      }
    } catch {
      /* non-fatal — try next legacy name */
    }
  }
  return false;
}

export async function isLlmCached(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(getLlmModelPath());
    if (
      info.exists &&
      'size' in info &&
      typeof info.size === 'number' &&
      info.size >= MIN_SIZE_BYTES
    ) {
      return true;
    }
    return await migrateFromLegacy();
  } catch {
    return false;
  }
}

export async function getLlmSizeBytes(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(getLlmModelPath());
    if (info.exists && 'size' in info && typeof info.size === 'number') return info.size;
  } catch {
    /* non-fatal */
  }
  return 0;
}

export async function importLlmFromUri(sourceUri: string, fileSizeHint?: number): Promise<void> {
  const destPath = getLlmModelPath();
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  const info = await FileSystem.getInfoAsync(destPath);
  const size =
    info.exists && 'size' in info && typeof info.size === 'number'
      ? info.size
      : (fileSizeHint ?? 0);
  if (size < MIN_SIZE_BYTES) {
    await FileSystem.deleteAsync(destPath, { idempotent: true }).catch(() => undefined);
    throw new Error(
      `File too small (${String(Math.round(size / 1_000_000))} MB). Expected a GGUF model ≥200 MB. Check you selected the right file.`
    );
  }
}

export async function deleteLlm(): Promise<void> {
  const path = getLlmModelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
}
