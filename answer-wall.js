// The student and teacher answer-wall renderers subscribe to Supabase Realtime changes.
export function sortAnswers(items) {
  return [...items].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
}
