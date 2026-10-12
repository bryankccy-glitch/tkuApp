import { Check } from 'lucide-react';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

export function TaskCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={task.completed}
      aria-label={t(task.completed ? 'task.markUndone' : 'task.markDone', { title: task.title })}
      onClick={onToggle}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        task.completed ? 'border-success bg-success text-white' : task.priority === 'high' ? 'border-heritage hover:bg-heritage/10' : 'border-muted/60 hover:bg-sunken',
      )}
    >
      {task.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );
}
