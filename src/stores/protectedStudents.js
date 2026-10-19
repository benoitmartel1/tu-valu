export const SURNAME_FUNCTION = "student-surnames";
import { supabase } from "../supabase";

async function invoke(body) {
  const {data,error}=await supabase.functions.invoke(SURNAME_FUNCTION,{body});
  if(error || data?.error) throw new Error(data?.error || 'Impossible de traiter les données des élèves.');
  return data.students;
}
export async function listProtectedStudents() { return invoke({action:'list'}); }
export async function createProtectedStudents(students) {
  try { return {data:await invoke({action:'create',students}),error:null}; }
  catch(error) { return {data:null,error}; }
}
export async function updateProtectedStudent(student) {
  try { return {data:await invoke({action:'update',student}),error:null}; }
  catch(error) { return {data:null,error}; }
}
export function compareProtectedStudentNames(a,b,field='firstname') {
  const first=(a.firstname||'').localeCompare(b.firstname||'','fr-FR');
  const hasA=Number.isInteger(a.surname_order),hasB=Number.isInteger(b.surname_order);
  const last=hasA&&hasB?a.surname_order-b.surname_order:
    hasA!==hasB?(hasA?-1:1):(a.lastname||'').localeCompare(b.lastname||'','fr-FR');
  return field==='lastname'?last||first:first||last;
}
