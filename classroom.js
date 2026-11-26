export function watchClassroom(supabase, classroomId, onChange) {
  const channel = supabase.channel(`classroom-${classroomId}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "classrooms", filter: `id=eq.${classroomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "classroom_content", filter: `classroom_id=eq.${classroomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "questions", filter: `classroom_id=eq.${classroomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "answer_wall_items", filter: `classroom_id=eq.${classroomId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
