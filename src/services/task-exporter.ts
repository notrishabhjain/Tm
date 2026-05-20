import type { Task } from '@/domain/types';

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function tasksToCSV(tasks: Task[]): string {
  const headers = [
    'id',
    'title',
    'body',
    'source_app',
    'sender',
    'priority',
    'status',
    'confidence',
    'created_at',
    'completed_at',
  ];
  const rows = tasks.map((t) =>
    [
      t.id,
      t.title,
      t.body ?? '',
      t.sourceApp,
      t.sender ?? '',
      t.priority,
      t.status,
      t.confidence.toFixed(3),
      new Date(t.createdAt).toISOString(),
      t.completedAt ? new Date(t.completedAt).toISOString() : '',
    ]
      .map(escapeCsvField)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function tasksToJSON(tasks: Task[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        sourceApp: t.sourceApp,
        sender: t.sender,
        priority: t.priority,
        status: t.status,
        confidence: t.confidence,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    },
    null,
    2
  );
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export function parseImportJSON(json: string): { tasks: Partial<Task>[]; errors: string[] } {
  const errors: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(json) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = Array.isArray(parsed) ? parsed : (parsed?.tasks ?? []);
    if (!Array.isArray(raw)) {
      return { tasks: [], errors: ['Invalid format: expected array or {tasks:[]}'] };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks: Partial<Task>[] = raw.map((item: any, i: number) => {
      if (!item?.title) errors.push(`Row ${i}: missing title`);
      return {
        title: String(item?.title ?? ''),
        body: item?.body ? String(item.body) : null,
        sourceApp: String(item?.sourceApp ?? 'import'),
        sender: item?.sender ? String(item.sender) : null,
        priority: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(item?.priority)
          ? item.priority
          : 'MEDIUM',
        status: 'PENDING',
        confidence: typeof item?.confidence === 'number' ? item.confidence : 0.5,
        createdAt: typeof item?.createdAt === 'number' ? item.createdAt : Date.now(),
      };
    });
    return { tasks, errors };
  } catch (e) {
    return { tasks: [], errors: [`Parse error: ${String(e)}`] };
  }
}
