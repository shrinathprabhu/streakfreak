import {
  performDataTask,
  type DataTask,
  type DataTaskResponse,
} from '../lib/data-tasks.ts';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<DataTask>) => void;
  postMessage: (message: DataTaskResponse) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    scope.postMessage({ ok: true, result: await performDataTask(data) });
  } catch (error) {
    scope.postMessage({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to process this backup. Please try again.',
    });
  }
};
