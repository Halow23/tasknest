import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('custom fields integration', () => {
  it('renders custom field controls in both task dialogs and submits field values', async () => {
    const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
    const drawer = await readFile(new URL('./home/TaskDrawer.tsx', import.meta.url), 'utf8');

    expect(home).toContain('tasknest.field.list');
    expect(home).toContain('fieldValues: toFieldValuesInput(newTaskFieldValues)');
    expect(drawer).toContain('<TaskCustomFields fields={fields}');
    expect(drawer).toContain('fieldValues: toFieldValuesInput(fieldValues)');
    expect(drawer).toContain('task.fieldValues?.length > 0');
  });

  it('keeps the project edit dialog free of the custom fields manager', async () => {
    const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
    expect(home).not.toContain('ProjectFieldsManager');
  });

  it('keeps date pickers from overflowing when the clear button is shown', async () => {
    const helpers = await readFile(new URL('./home/helpers.tsx', import.meta.url), 'utf8');
    const fields = await readFile(new URL('../components/TaskCustomFields.tsx', import.meta.url), 'utf8');
    expect(helpers).toContain('flex-1 min-w-0 justify-start');
    expect(fields).toContain('flex-1 min-w-0 justify-start');
  });

  it('replaces native select and date inputs with shadcn Select and Calendar components', async () => {
    const home = await readFile(new URL('./Home.tsx', import.meta.url), 'utf8');
    const drawer = await readFile(new URL('./home/TaskDrawer.tsx', import.meta.url), 'utf8');

    expect(drawer).toContain('<SelectTrigger id="edit-priority"');
    expect(drawer).toContain('<DueDatePicker id="edit-due" value={dueDate} onChange={setDueDate} />');
    expect(home).toContain('<SelectTrigger id="task-assignee"');
    expect(home).not.toContain('<select id="task-assignee"');
    expect(home).not.toContain('type="date"');
  });
});
