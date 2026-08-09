export async function processCursorBatches<T extends { id: string }>(options: {
  fetchBatch: (cursor: string | undefined) => Promise<T[]>;
  onBatchComplete?: (processed: number) => void;
  processRecord: (record: T) => Promise<void>;
}): Promise<number> {
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const records = await options.fetchBatch(cursor);
    if (records.length === 0) return processed;

    for (const record of records) await options.processRecord(record);
    processed += records.length;
    cursor = records.at(-1)?.id;
    options.onBatchComplete?.(processed);
  }
}
