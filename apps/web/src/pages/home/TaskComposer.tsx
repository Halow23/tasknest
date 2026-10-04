import { useState } from 'react';
import { CalendarDays, CircleDashed, Flag, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LabelPicker } from '@/components/LabelPicker';
import { TaskCustomFields, type ProjectField } from '@/components/TaskCustomFields';
import { cn } from '@/lib/utils';
import { DueDatePicker, formatDate } from './helpers';
import { columns, priorityStyle, type Member, type Priority, type Status } from './types';

/**
 * Quick-capture composer, modelled on the reference.
 *
 * The dialog stays short by keeping the four properties collapsed as plain
 * text buttons that only expand into popovers on click — no labels, no boxes.
 * That is the whole trick.
 *
 * Deliberately NOT copied from the reference: it blocks empty submits with no
 * feedback at all. Here the submit button stays disabled and, if the title is
 * touched and cleared, an inline message explains why.
 */
export function TaskComposer({
  open,
  onOpenChange,
  members,
  workspaceId,
  projectFields,
  templates,
  onApplyTemplate,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  assigneeId,
  onAssigneeChange,
  dueDate,
  onDueDateChange,
  labelIds,
  onLabelIdsChange,
  fieldValues,
  onFieldValuesChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  workspaceId: string;
  projectFields: ProjectField[];
  templates: { id: string; name: string }[];
  onApplyTemplate: (templateId: string) => void;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  status: Status;
  onStatusChange: (value: Status) => void;
  priority: Priority;
  onPriorityChange: (value: Priority) => void;
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  labelIds: string[];
  onLabelIdsChange: (value: string[]) => void;
  fieldValues: Record<string, string>;
  onFieldValuesChange: (value: Record<string, string>) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const [titleTouched, setTitleTouched] = useState(false);
  const canSubmit = title.trim().length > 0 && !pending;
  const showTitleError = titleTouched && title.trim().length === 0;

  const assignee = members.find(member => String(member.id) === assigneeId);
  const assigneeLabel = assignee ? assignee.name || assignee.email || 'Teammate' : 'Assignee';
  const statusLabel = columns.find(column => column.id === status)?.title ?? 'Status';
  const dueLabel = dueDate ? formatDate(new Date(`${dueDate}T12:00:00`)) : 'Due date';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-tn-panel p-4 sm:max-w-[560px]">
        <DialogHeader className="sr-only">
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        {templates.length > 0 && (
          <div className="mb-2">
            <Select value="" onValueChange={onApplyTemplate}>
              <SelectTrigger id="task-template" className="h-8 w-full border-0 bg-transparent px-1 text-tn-body-2 text-tn-text-secondary shadow-none">
                <SelectValue placeholder="Start from a template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Borderless title: reads as a heading, not a field. */}
        <Textarea
          id="task-title"
          value={title}
          onChange={event => onTitleChange(event.target.value)}
          onBlur={() => setTitleTouched(true)}
          placeholder="Task title"
          rows={1}
          autoFocus
          className="min-h-0 resize-none border-0 bg-transparent p-1 text-tn-title-2 font-medium leading-7 text-foreground shadow-none placeholder:text-tn-text-tertiary focus-visible:ring-0"
        />
        {showTitleError && (
          <p role="alert" className="px-1 text-tn-caption-1 text-tn-danger">
            Give the task a title before adding it.
          </p>
        )}

        <Textarea
          value={description}
          onChange={event => onDescriptionChange(event.target.value)}
          placeholder="Add a description…"
          rows={2}
          className="min-h-0 resize-none border-0 bg-transparent p-1 text-tn-body text-tn-text-secondary shadow-none placeholder:text-tn-text-tertiary focus-visible:ring-0"
        />

        {/* Collapsed property pickers — the dialog stays short because of these. */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-tn-chip px-2 text-tn-body-2 transition-colors hover:bg-black/5',
                'text-tn-text-secondary',
              )}>
                <CircleDashed className="h-3.5 w-3.5" />{statusLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              {columns.map(column => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => onStatusChange(column.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-tn-control px-2 py-1.5 text-left text-tn-body-2',
                    column.id === status ? 'bg-accent text-accent-foreground' : 'hover:bg-black/5',
                  )}
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', column.color)} />
                  {column.title}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-7 items-center gap-1.5 rounded-tn-chip px-2 text-tn-body-2 text-tn-text-secondary transition-colors hover:bg-black/5">
                <Flag className="h-3.5 w-3.5" />
                <span className={cn('rounded-tn-chip px-1.5 capitalize', priorityStyle[priority])}>{priority}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1">
              {(['low', 'medium', 'high'] as Priority[]).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPriorityChange(value)}
                  className={cn(
                    'flex w-full items-center rounded-tn-control px-2 py-1.5 text-left',
                    value === priority ? 'bg-accent' : 'hover:bg-black/5',
                  )}
                >
                  <span className={cn('rounded-tn-chip px-1.5 py-0.5 text-tn-body-2 capitalize', priorityStyle[value])}>{value}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-7 items-center gap-1.5 rounded-tn-chip px-2 text-tn-body-2 text-tn-text-secondary transition-colors hover:bg-black/5">
                <UserRound className="h-3.5 w-3.5" />{assigneeLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <button
                type="button"
                onClick={() => onAssigneeChange('unassigned')}
                className={cn('flex w-full items-center gap-2 rounded-tn-control px-2 py-1.5 text-left text-tn-body-2', assigneeId === 'unassigned' ? 'bg-accent' : 'hover:bg-black/5')}
              >
                Unassigned
              </button>
              {members.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onAssigneeChange(String(member.id))}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-tn-control px-2 py-1.5 text-left text-tn-body-2',
                    String(member.id) === assigneeId ? 'bg-accent' : 'hover:bg-black/5',
                  )}
                >
                  {member.name || member.email || 'Teammate'}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-tn-chip px-2 text-tn-body-2 transition-colors hover:bg-black/5',
                dueDate ? 'text-tn-text-secondary' : 'text-tn-text-tertiary',
              )}>
                <CalendarDays className="h-3.5 w-3.5" />{dueLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <Label htmlFor="task-due" className="text-tn-body-2">Due date</Label>
              <div className="mt-2">
                <DueDatePicker id="task-due" value={dueDate} onChange={onDueDateChange} />
              </div>
              {dueDate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onDueDateChange('')} className="mt-2 h-7 w-full text-tn-caption-1">
                  Clear due date
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LabelPicker workspaceId={workspaceId} selectedIds={labelIds} onChange={onLabelIdsChange} />
        </div>

        {projectFields.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-tn-caption-1 font-medium uppercase tracking-[0.12em] text-tn-text-secondary">Custom fields</p>
            <TaskCustomFields fields={projectFields} values={fieldValues} onChange={onFieldValuesChange} />
          </div>
        )}

        <DialogFooter className="mt-4 flex-row items-center justify-end gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-8 rounded-tn-control text-tn-body-2">
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={onSubmit} className="tn-primary h-8 rounded-tn-control text-tn-body-2 font-medium">
            {pending ? 'Adding…' : 'Add task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
