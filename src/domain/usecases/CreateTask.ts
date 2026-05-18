import type { Task, Priority, Language } from '../types';
import type { TaskRepository } from '../../data/repositories/TaskRepository';

export interface CreateTaskInput {
  title: string;
  body: string | null;
  sourceApp: string;
  sender: string | null;
  priority: Priority;
  confidence: number;
  needsConfirmation: boolean;
  matchedKeywords: string[];
  language: Language;
}

export async function createTask(
  repo: TaskRepository,
  input: CreateTaskInput
): Promise<Task> {
  return repo.createTask(input);
}
