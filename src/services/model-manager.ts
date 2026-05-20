import * as FileSystem from 'expo-file-system';

// Quantized all-MiniLM-L6-v2 from Xenova — 22 MB, sentence embeddings
const MODEL_URL =
  'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx';
const MODEL_FILENAME = 'taskmind_minilm_v2_q.onnx';
const MODEL_EXPECTED_SIZE_MIN = 20_000_000; // 20 MB lower bound sanity check

export function getModelLocalPath(): string {
  return `${FileSystem.documentDirectory ?? ''}${MODEL_FILENAME}`;
}

export async function isModelCached(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(getModelLocalPath());
    if (!info.exists) return false;
    if ('size' in info && typeof info.size === 'number') {
      return info.size >= MODEL_EXPECTED_SIZE_MIN;
    }
    return info.exists;
  } catch {
    return false;
  }
}

export async function downloadModel(onProgress?: (fraction: number) => void): Promise<string> {
  const localPath = getModelLocalPath();

  const callback = onProgress
    ? ({ totalBytesWritten, totalBytesExpectedToWrite }: FileSystem.DownloadProgressData) => {
        if (totalBytesExpectedToWrite > 0) {
          onProgress(totalBytesWritten / totalBytesExpectedToWrite);
        }
      }
    : undefined;

  const downloadResumable = FileSystem.createDownloadResumable(MODEL_URL, localPath, {}, callback);

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) throw new Error('Model download failed — no URI returned');
  return result.uri;
}

export async function deleteModel(): Promise<void> {
  const localPath = getModelLocalPath();
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) await FileSystem.deleteAsync(localPath, { idempotent: true });
}
