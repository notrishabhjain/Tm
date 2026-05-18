import type { Task } from '../types';
import type { TaskRepository } from '../../data/repositories/TaskRepository';

export async function deleteTask(repo: TaskRepository, id: string): Promise<Task> {
  return repo.deleteTask(id);
}
