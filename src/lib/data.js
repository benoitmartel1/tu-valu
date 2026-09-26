import { supabase } from "../supabase";
export { allRows } from "./paging.js";
export async function mutate(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
export async function duplicateRecord(kind, id, includeMembers = false) {
  return mutate(
    supabase.rpc("tu_duplicate_record", {
      kind,
      source_id: id,
      include_members: includeMembers,
    }),
  );
}
export function downloadCsv(name, contents) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `rapport_${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
