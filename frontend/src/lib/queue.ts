export const QUEUE_LABELS: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  900: 'League Classic',
}

export function getQueueLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? 'Ranked'
}
