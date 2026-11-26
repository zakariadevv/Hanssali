import { supabase } from "./supabase.js";
import { MEDIA_BUCKET } from "./config.js";
import { api, toast, uploadMedia } from "./api.js";
import { createCanvasEditor } from "./canvas-editor.js";
const $ = (id) => document.getElementById(id);
let teacherToken = localStorage.getItem("hansali_teacher_token") || "";
let classroom = null, activeQuestion = null, activeCanvasDocument = null, answerRefreshTimer = null;
const SAVED_SESSIONS_KEY = "hansali_saved_sessions";
const canvasEditor = createCanvasEditor({root:$("canvasEditor"),onSave:document=>teacherCall("save_canvas",{classroomId:classroom.id,document}),onUpload:async file=>{const up=await uploadMedia(file,{classroomId:classroom.id,teacherToken});return {...up,url:await mediaUrl(up.path)};},onResolveImage:path=>mediaUrl(path),onToast:message=>toast(message)});
const studio = $("teacherStudio");
function showStudio() { studio.classList.remove("hidden"); }
function readSavedSessions(){
 try{const value=JSON.parse(localStorage.getItem(SAVED_SESSIONS_KEY)||"[]");return Array.isArray(value)?value.filter(x=>x&&x.id&&x.teacherToken):[];}catch{return [];}
}
function writeSavedSessions(items){localStorage.setItem(SAVED_SESSIONS_KEY,JSON.stringify(items));renderSavedSessions();}
function saveSession(room,tokenValue){
 const items=readSavedSessions().filter(x=>x.id!==room.id);
 items.unshift({id:room.id,title:room.title,room_code:room.room_code,teacherToken:tokenValue,savedAt:new Date().toISOString()});
 writeSavedSessions(items);
}
function removeSavedSession(id){writeSavedSessions(readSavedSessions().filter(x=>x.id!==id));}
function renderSavedSessions(){
 const items=readSavedSessions(),list=$("savedSessionsList");
 if(!$("savedSessionsPanel"))return;
 $("savedSessionCount").textContent=items.length+" SESSION"+(items.length===1?"":"S");
 list.innerHTML=items.length?items.map(item=>`<article class="saved-session-row"><div class="saved-session-info"><strong>${escapeHtml(item.title||"Untitled classroom")}</strong><span>ROOM / ${escapeHtml(item.room_code||"------")} · SAVED ${new Date(item.savedAt||Date.now()).toLocaleDateString()}</span></div><div class="saved-session-actions"><button class="btn btn-light btn-small" type="button" data-open-saved="${escapeAttr(item.id)}">Open session</button><button class="btn btn-danger btn-small" type="button" data-delete-saved="${escapeAttr(item.id)}">Delete</button></div></article>`).join(""):'<p class="muted saved-empty">No saved sessions yet. New classrooms will appear here automatically.</p>';
 list.querySelectorAll("[data-open-saved]").forEach(button=>button.addEventListener("click",async()=>{
  const item=readSavedSessions().find(x=>x.id===button.dataset.openSaved);if(!item)return;
  button.disabled=true;button.textContent="Opening…";
  try{teacherToken=item.teacherToken;localStorage.setItem("hansali_teacher_token",teacherToken);localStorage.setItem("hansali_classroom_id",item.id);await api("update_classroom",{teacherToken,classroomId:item.id,patch:{status:"open"}});const data=await api("load",{teacherToken,classroomId:item.id});await loadRoom(data.classroom);toast("Saved session reopened. Students must join again with the room code.");}
  catch(error){removeSavedSession(item.id);toast("This saved session is no longer available.");}
  finally{button.disabled=false;button.textContent="Open session";}
 }));
 list.querySelectorAll("[data-delete-saved]").forEach(button=>button.addEventListener("click",async()=>{
  const item=readSavedSessions().find(x=>x.id===button.dataset.deleteSaved);if(!item)return;
  if(!confirm(`Permanently delete "${item.title||"this session"}" and all its classroom data? This cannot be undone.`))return;
  button.disabled=true;button.textContent="Deleting…";
  try{
   await api("delete_classroom",{teacherToken:item.teacherToken,classroomId:item.id});
   removeSavedSession(item.id);
   if(classroom?.id===item.id){
    if(answerRefreshTimer){clearInterval(answerRefreshTimer);answerRefreshTimer=null;}
    classroom=null;activeQuestion=null;activeCanvasDocument=null;teacherToken="";
    localStorage.removeItem("hansali_teacher_token");localStorage.removeItem("hansali_classroom_id");
    canvasEditor.loadDocument(null);$("classroomPanel").classList.add("hidden");$("noClassroom").classList.remove("hidden");
   }
   toast("Session permanently deleted.");
  }catch(error){button.disabled=false;button.textContent="Delete";toast(error.message||"Could not delete this session.");}
 }));
}
function migrateLegacySavedSession(){
 const oldId=localStorage.getItem("hansali_classroom_id"),oldToken=localStorage.getItem("hansali_teacher_token");
 if(oldId&&oldToken&&!readSavedSessions().some(x=>x.id===oldId)){
  const items=readSavedSessions();items.unshift({id:oldId,title:"Saved classroom",room_code:"",teacherToken:oldToken,savedAt:new Date().toISOString()});
  localStorage.setItem(SAVED_SESSIONS_KEY,JSON.stringify(items));
 }
}

async function teacherCall(action, extra={}) { return api(action,{teacherToken,...extra}); }
async function refresh() {
  if (!classroom) return;
  const data = await api("load", {teacherToken, classroomId:classroom.id});
  classroom=data.classroom;
  $("roomTitleDisplay").textContent=classroom.title;
  $("roomCodeDisplay").textContent=classroom.room_code;
  $("roomStatus").textContent=classroom.status.toUpperCase();
  $("studentCount").textContent=data.participants.length;
  $("toggleOpen").checked=classroom.status==="open";
  $("toggleParticipation").checked=classroom.participation_enabled;
  $("toggleSubmissions").checked=classroom.submissions_enabled;
  $("toggleIdentities").checked=classroom.identities_visible;
  $("contentList").innerHTML=data.content.length?data.content.map(c=>`<div class="item-row"><span>${escapeHtml(c.kind.toUpperCase())} · ${escapeHtml(c.payload?.text||c.payload?.name||c.payload?.url||"Published item")}</span><small>${new Date(c.created_at).toLocaleTimeString()}</small></div>`).join(""):'<p class="muted">Nothing published yet.</p>';
  activeQuestion=data.questions[0]||null;
  const canvasContent=data.content.find(c=>c.kind==="canvas"&&c.is_active);
  activeCanvasDocument=canvasContent?.payload?.document||null;
  $("activeQuestion").innerHTML=data.questions.length?'<div class="question-manager"><div class="question-manager-title">QUESTIONS / '+data.questions.length+'</div>'+data.questions.map((q,i)=>'<article class="question-manage-row '+(q.is_hidden?"is-hidden":"")+'"><div class="question-manage-copy"><span class="question-number">Q'+(data.questions.length-i)+'</span><strong>'+escapeHtml(q.prompt)+'</strong><small>'+(q.is_hidden?"HIDDEN FROM STUDENTS":q.is_open?"OPEN FOR ANSWERS":"ANSWERS CLOSED")+' · '+new Date(q.created_at).toLocaleString()+'</small></div><div class="question-manage-actions"><button type="button" data-question-toggle="'+q.id+'" data-hidden="'+(q.is_hidden?"true":"false")+'">'+(q.is_hidden?"Show":"Hide")+'</button><button type="button" data-question-open="'+q.id+'" data-open="'+(q.is_open?"true":"false")+'">'+(q.is_open?"Close answers":"Open answers")+'</button><button type="button" data-question-answers="'+q.id+'" data-show="'+(q.show_answers?"true":"false")+'">'+(q.show_answers?"Hide student answers":"Show to students")+'</button><button type="button" class="danger" data-question-delete="'+q.id+'">Delete</button></div></article>').join("")+'</div>':'<p class="muted">No questions published yet.</p>';
  document.querySelectorAll("[data-question-toggle]").forEach(b=>b.addEventListener("click",async()=>{try{await teacherCall("update_question",{classroomId:classroom.id,questionId:b.dataset.questionToggle,patch:{is_hidden:b.dataset.hidden!=="true"}});await refresh();toast(b.dataset.hidden==="true"?"Question shown to students.":"Question hidden from students.");}catch(e){toast(e.message);}}));
  document.querySelectorAll("[data-question-open]").forEach(b=>b.addEventListener("click",async()=>{try{await teacherCall("update_question",{classroomId:classroom.id,questionId:b.dataset.questionOpen,patch:{is_open:b.dataset.open!=="true"}});await refresh();}catch(e){toast(e.message);}}));
  document.querySelectorAll("[data-question-answers]").forEach(b=>b.addEventListener("click",async()=>{try{await teacherCall("update_question",{classroomId:classroom.id,questionId:b.dataset.questionAnswers,patch:{show_answers:b.dataset.show!=="true"}});await refresh();toast(b.dataset.show==="true"?"Answers hidden from students.":"Answers shown to students.");}catch(e){toast(e.message);}}));
  document.querySelectorAll("[data-question-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this question and all answers submitted to it? This cannot be undone."))return;try{await teacherCall("delete_question",{classroomId:classroom.id,questionId:b.dataset.questionDelete});await refresh();toast("Question and its answers deleted.");}catch(e){toast(e.message);}}));
  const visibleAnswers=activeQuestion?data.answers.filter(a=>a.question_id===activeQuestion.id):[];
  $("answerCountLabel").textContent=`${visibleAnswers.length} RESPONSES`;
  $("teacherAnswerWall").innerHTML=visibleAnswers.length?visibleAnswers.map(a=>`<article class="teacher-answer ${a.is_highlighted?"highlight":""}"><span class="mono">${a.display_name?escapeHtml(a.display_name):"ANONYMOUS"} · ${new Date(a.created_at).toLocaleTimeString()}</span><p>${escapeHtml(a.text_content||"")}</p>${a.image_path?`<img data-media-path="${escapeAttr(a.image_path)}" style="max-width:100%;max-height:120px">`:""}${a.link_url?`<a href="${escapeAttr(a.link_url)}" target="_blank" rel="noopener">Open submitted link ↗</a>`:""}<button data-highlight="${a.id}" data-value="${!a.is_highlighted}">${a.is_highlighted?"Unhighlight":"Highlight"}</button></article>`).join(""):'<p class="muted">Answers will appear here in real time.</p>';
  await Promise.all([...document.querySelectorAll("#teacherAnswerWall [data-media-path]")].map(async img=>{try{img.src=await mediaUrl(img.dataset.mediaPath);}catch{}}));
  document.querySelectorAll("[data-highlight]").forEach(b=>b.addEventListener("click",async()=>{await teacherCall("highlight_answer",{classroomId:classroom.id,answerId:b.dataset.highlight,highlighted:b.dataset.value==="true"});await refresh();}));
}
async function mediaUrl(path){const {data,error}=await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escapeAttr(s=""){return escapeHtml(s);}
function ensureAnswerPolling(){if(answerRefreshTimer)return;answerRefreshTimer=setInterval(()=>{if(classroom)refresh().catch(()=>{});},4000);}
async function loadRoom(room){classroom=room;localStorage.setItem("hansali_classroom_id",room.id);saveSession(room,teacherToken);$("noClassroom").classList.add("hidden");$("classroomPanel").classList.remove("hidden");$("roomLinkText").textContent="";showStudio();await refresh();canvasEditor.loadDocument(activeCanvasDocument);ensureAnswerPolling();}
$("createRoomForm").addEventListener("submit",async e=>{e.preventDefault();try{const r=await teacherCall("create_classroom",{title:$("roomTitle").value});teacherToken=r.teacherToken;localStorage.setItem("hansali_teacher_token",teacherToken);saveSession(r.classroom,teacherToken);await loadRoom(r.classroom);toast("Classroom created.");}catch(err){toast(err.message);}});
$("logoutTeacher").addEventListener("click",async()=>{
 if(!classroom||!teacherToken)return;
 const button=$("logoutTeacher");
 button.disabled=true;
 try{
  await teacherCall("end_session",{classroomId:classroom.id});
  localStorage.removeItem("hansali_teacher_token");
  localStorage.removeItem("hansali_classroom_id");
  teacherToken="";classroom=null;activeQuestion=null;activeCanvasDocument=null;
  if(answerRefreshTimer){clearInterval(answerRefreshTimer);answerRefreshTimer=null;}
  canvasEditor.loadDocument(null);
  $("classroomPanel").classList.add("hidden");
  $("noClassroom").classList.remove("hidden");
  renderSavedSessions();showStudio();
  toast("Session ended. All students were disconnected; saved classroom data is safe.");
 }catch(error){toast(error.message||"Could not end the session. Please try again.");}
 finally{button.disabled=false;}
});
$("copyRoomLink").addEventListener("click",async()=>{const code=$("roomCodeDisplay").textContent.trim();if(!code||code==="------")return toast("Room code is not ready yet.");try{await navigator.clipboard.writeText(code);toast("Room code copied: "+code);}catch{toast("Could not copy the room code.");}});
$("deleteClassroom").addEventListener("click",async()=>{
  if(!classroom)return;
  const title=classroom.title||"this classroom";
  if(!confirm(`Delete "${title}" permanently? This removes its slides, questions, answers, participants and uploaded files. Students will be disconnected. This cannot be undone.`))return;
  const button=$("deleteClassroom");button.disabled=true;button.textContent="Deleting…";
  try{
    await teacherCall("delete_classroom",{classroomId:classroom.id});
    
    if(answerRefreshTimer){clearInterval(answerRefreshTimer);answerRefreshTimer=null;}
    localStorage.removeItem("hansali_teacher_token");
    localStorage.removeItem("hansali_classroom_id");
    removeSavedSession(classroom.id);
    teacherToken="";classroom=null;activeQuestion=null;activeCanvasDocument=null;
    canvasEditor.loadDocument(null);
    $("classroomPanel").classList.add("hidden");
    $("noClassroom").classList.remove("hidden");
    $("roomTitle").value="";
    button.disabled=false;button.textContent="Delete classroom";
    toast("Classroom and its data were permanently deleted.");
  }catch(e){button.disabled=false;button.textContent="Delete classroom";toast(e.message||"Could not delete the classroom.");}
});
async function setRoom(patch){try{const r=await teacherCall("update_classroom",{classroomId:classroom.id,patch});classroom=r.classroom;await refresh();}catch(e){toast(e.message);}}
$("toggleOpen").addEventListener("change",e=>setRoom({status:e.target.checked?"open":"closed"}));
$("toggleParticipation").addEventListener("change",e=>setRoom({participation_enabled:e.target.checked}));
$("toggleSubmissions").addEventListener("change",e=>setRoom({submissions_enabled:e.target.checked}));
$("toggleIdentities").addEventListener("change",e=>setRoom({identities_visible:e.target.checked}));
document.querySelectorAll("[data-theme]").forEach(b=>b.addEventListener("click",()=>{const themes={paper:{background:"#F3F0E8",foreground:"#152B45",accent:"#4169E1"},navy:{background:"#152B45",foreground:"#F3F0E8",accent:"#9CB7FF"},blue:{background:"#4169E1",foreground:"#FFFFFF",accent:"#D9DDE5"}};setRoom({theme:{...classroom.theme,...themes[b.dataset.theme]}});toast("Theme updated.");}));
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",async()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tool-panel").forEach(x=>x.classList.add("hidden"));$("tab-"+b.dataset.tab).classList.remove("hidden");if(b.dataset.tab==="answers")try{await refresh();}catch(e){toast(e.message);}}));
$("textContentForm").addEventListener("submit",async e=>{e.preventDefault();try{await teacherCall("publish_content",{classroomId:classroom.id,kind:"text",payload:{text:$("contentText").value}});$("contentText").value="";await refresh();toast("Text published.");}catch(e){toast(e.message);}});
$("linkContentForm").addEventListener("submit",async e=>{e.preventDefault();try{const url=$("contentLink").value;if(!/^https?:\/\//i.test(url))throw Error("Enter a valid http(s) URL.");await teacherCall("publish_content",{classroomId:classroom.id,kind:"link",payload:{url}});$("contentLink").value="";await refresh();toast("Link shared.");}catch(e){toast(e.message);}});
$("fileContentForm").addEventListener("submit",async e=>{e.preventDefault();const f=$("contentFile").files[0];if(!f)return toast("Choose a file first.");try{const up=await uploadMedia(f,{classroomId:classroom.id,teacherToken});const kind=f.type.startsWith("image/")?"image":f.type.startsWith("video/")?"video":"presentation";await teacherCall("publish_content",{classroomId:classroom.id,kind,payload:{url:up.url,path:up.path,name:f.name,mime:f.type}});$("contentFile").value="";await refresh();toast("File published.");}catch(e){toast(e.message);}});
$("questionForm").addEventListener("submit",async e=>{e.preventDefault();try{const prompt=$("questionPrompt").value;if(!prompt.trim())return;await teacherCall("publish_question",{classroomId:classroom.id,prompt,attachmentPath:null,allowText:true,allowImage:false,allowLink:false});$("questionPrompt").value="";await refresh();document.querySelector('[data-tab="question"]').click();toast("Question is live.");}catch(e){toast(e.message);}});

$("clearAnswers").addEventListener("click",async()=>{if(!activeQuestion)return toast("No active question.");if(!confirm("Clear all answers for this question?"))return;try{await teacherCall("clear_answers",{classroomId:classroom.id,questionId:activeQuestion.id});await refresh();toast("Answers cleared.");}catch(e){toast(e.message);}});
if(teacherToken){
  const savedRoomId=localStorage.getItem("hansali_classroom_id");
  if(savedRoomId){
    api("load",{teacherToken,classroomId:savedRoomId})
      .then(data=>loadRoom(data.classroom))
      .catch(()=>{localStorage.removeItem("hansali_teacher_token");localStorage.removeItem("hansali_classroom_id");teacherToken="";showStudio();});
  } else showStudio();
}
