/** CSV cell escaping matching the admin audit export (wrap + double-quote doubling). */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(rows: unknown[][], fileName: string) {
  const blob = new Blob([rows.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
