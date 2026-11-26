import { supabase } from "./supabase.js";
import { api, toast, uploadMedia } from "./api.js";
import { watchClassroom } from "./classroom.js";
import { createCanvasEditor } from "./canvas-editor.js";
const $ = (id) => document.getElementById(id);
let teacherToken = localStorage.getItem("hansali_teacher_token") || "";
let classroom = null, stopWatch = null, activeQuestion = null, activeCanvasDocument = null;
const canvasEditor = createCanvasEditor({root:$("canvasEditor"),onSave:document=>teacherCall("save_canvas",{classroomId:classroom.id,document}),onUpload:async file=>{const up=await uploadMedia(file,{classroomId:classroom.id,teacherToken});return {...up,url:await mediaUrl(up.path)};},onResolveImage:path=>mediaUrl(path),onToast:message=>toast(message)});
const studio = $("teacherStudio");
function showStudio() { studio.classList.remove("hidden"); }
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
  $("activeQuestion").innerHTML=activeQuestion?`<div class="item-row"><span>${escapeHtml(activeQuestion.prompt)}</span><small>${activeQuestion.is_open?"OPEN":"CLOSED"}</small><button id="toggleQuestion">${activeQuestion.is_open?"Close":"Reopen"}</button><button id="toggleReveal">${activeQuestion.show_answers?"Hide answers":"Reveal answers"}</button></div>`:"";
  const layout=activeQuestion?.display_layout||{direction:"vertical",order:"text-first",align:"center",image_width:55};
  $("questionDirection").value=layout.direction||"vertical";$("questionOrder").value=layout.order||"text-first";$("questionAlign").value=layout.align||"center";$("questionImageWidth").value=layout.image_width||55;$("questionImageWidthValue").textContent=(layout.image_width||55)+"%";
  $("applyQuestionLayout").hidden=!activeQuestion;
  if(activeQuestion){
    $("toggleQuestion")?.addEventListener("click",()=>questionPatch({is_open:!activeQuestion.is_open}));
    $("toggleReveal")?.addEventListener("click",()=>questionPatch({show_answers:!activeQuestion.show_answers}));
  }
  const visibleAnswers=activeQuestion?data.answers.filter(a=>a.question_id===activeQuestion.id):[];
  $("answerCountLabel").textContent=`${visibleAnswers.length} RESPONSES`;
  $("teacherAnswerWall").innerHTML=visibleAnswers.length?visibleAnswers.map(a=>`<article class="teacher-answer ${a.is_highlighted?"highlight":""}"><span class="mono">${a.display_name?escapeHtml(a.display_name):"ANONYMOUS"} · ${new Date(a.created_at).toLocaleTimeString()}</span><p>${escapeHtml(a.text_content||"")}</p>${a.image_path?`<img data-media-path="${escapeAttr(a.image_path)}" style="max-width:100%;max-height:120px">`:""}${a.link_url?`<a href="${escapeAttr(a.link_url)}" target="_blank" rel="noopener">Open submitted link ↗</a>`:""}<button data-highlight="${a.id}" data-value="${!a.is_highlighted}">${a.is_highlighted?"Unhighlight":"Highlight"}</button></article>`).join(""):'<p class="muted">Answers will appear here in real time.</p>';
  await Promise.all([...document.querySelectorAll("#teacherAnswerWall [data-media-path]")].map(async img=>{try{img.src=await mediaUrl(img.dataset.mediaPath);}catch{}}));
  document.querySelectorAll("[data-highlight]").forEach(b=>b.addEventListener("click",async()=>{await teacherCall("highlight_answer",{classroomId:classroom.id,answerId:b.dataset.highlight,highlighted:b.dataset.value==="true"});await refresh();}));
}
async function mediaUrl(path){const {data,error}=await supabase.storage.from("hanssali-media").createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escapeAttr(s=""){return escapeHtml(s);}
async function loadRoom(room){classroom=room;localStorage.setItem("hansali_classroom_id",room.id);$("noClassroom").classList.add("hidden");$("classroomPanel").classList.remove("hidden");$("roomLinkText").textContent=`${location.origin}${location.pathname.replace("teacher.html","student.html")}?room=${room.room_code}`;showStudio();await refresh();canvasEditor.loadDocument(activeCanvasDocument);if(stopWatch)stopWatch();stopWatch=watchClassroom(supabase,room.id,()=>refresh().catch(()=>{}));}
$("createRoomForm").addEventListener("submit",async e=>{e.preventDefault();try{const r=await teacherCall("create_classroom",{title:$("roomTitle").value});teacherToken=r.teacherToken;localStorage.setItem("hansali_teacher_token",teacherToken);await loadRoom(r.classroom);toast("Classroom created.");}catch(err){toast(err.message);}});
$("logoutTeacher").addEventListener("click",async()=>{try{if(classroom)await teacherCall("teacher_revoke_session",{classroomId:classroom.id});}catch{}localStorage.removeItem("hansali_teacher_token");localStorage.removeItem("hansali_classroom_id");teacherToken="";classroom=null;if(stopWatch)stopWatch();$("classroomPanel").classList.add("hidden");$("noClassroom").classList.remove("hidden");showStudio();});
$("copyRoomLink").addEventListener("click",async()=>{await navigator.clipboard.writeText($("roomLinkText").textContent);toast("Student link copied.");});
async function setRoom(patch){try{const r=await teacherCall("update_classroom",{classroomId:classroom.id,patch});classroom=r.classroom;await refresh();}catch(e){toast(e.message);}}
$("toggleOpen").addEventListener("change",e=>setRoom({status:e.target.checked?"open":"closed"}));
$("toggleParticipation").addEventListener("change",e=>setRoom({participation_enabled:e.target.checked}));
$("toggleSubmissions").addEventListener("change",e=>setRoom({submissions_enabled:e.target.checked}));
$("toggleIdentities").addEventListener("change",e=>setRoom({identities_visible:e.target.checked}));
document.querySelectorAll("[data-theme]").forEach(b=>b.addEventListener("click",()=>{const themes={paper:{background:"#F3F0E8",foreground:"#152B45",accent:"#4169E1"},navy:{background:"#152B45",foreground:"#F3F0E8",accent:"#9CB7FF"},blue:{background:"#4169E1",foreground:"#FFFFFF",accent:"#D9DDE5"}};setRoom({theme:{...classroom.theme,...themes[b.dataset.theme]}});toast("Theme updated.");}));
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tool-panel").forEach(x=>x.classList.add("hidden"));$("tab-"+b.dataset.tab).classList.remove("hidden");}));
$("textContentForm").addEventListener("submit",async e=>{e.preventDefault();try{await teacherCall("publish_content",{classroomId:classroom.id,kind:"text",payload:{text:$("contentText").value}});$("contentText").value="";await refresh();toast("Text published.");}catch(e){toast(e.message);}});
$("linkContentForm").addEventListener("submit",async e=>{e.preventDefault();try{const url=$("contentLink").value;if(!/^https?:\/\//i.test(url))throw Error("Enter a valid http(s) URL.");await teacherCall("publish_content",{classroomId:classroom.id,kind:"link",payload:{url}});$("contentLink").value="";await refresh();toast("Link shared.");}catch(e){toast(e.message);}});
$("fileContentForm").addEventListener("submit",async e=>{e.preventDefault();const f=$("contentFile").files[0];if(!f)return toast("Choose a file first.");try{const up=await uploadMedia(f,{classroomId:classroom.id,teacherToken});const kind=f.type.startsWith("image/")?"image":f.type.startsWith("video/")?"video":"presentation";await teacherCall("publish_content",{classroomId:classroom.id,kind,payload:{url:up.url,path:up.path,name:f.name,mime:f.type}});$("contentFile").value="";await refresh();toast("File published.");}catch(e){toast(e.message);}});
$("questionForm").addEventListener("submit",async e=>{e.preventDefault();try{let attachmentPath=null;const qFile=$("questionFile").files[0];if(qFile){const uploaded=await uploadMedia(qFile,{classroomId:classroom.id,teacherToken});attachmentPath=uploaded.path;}await teacherCall("publish_question",{classroomId:classroom.id,prompt:$("questionPrompt").value,attachmentPath,allowText:$("allowText").checked,allowImage:$("allowImage").checked,allowLink:$("allowLink").checked,displayLayout:getQuestionLayout()});$("questionPrompt").value="";$("questionFile").value="";await refresh();document.querySelector('[data-tab="question"]').click();toast("Question is live.");}catch(e){toast(e.message);}});

function getQuestionLayout(){return {direction:$("questionDirection").value,order:$("questionOrder").value,align:$("questionAlign").value,image_width:Number($("questionImageWidth").value)};}
$("questionImageWidth").addEventListener("input",e=>$("questionImageWidthValue").textContent=e.target.value+"%");
$("applyQuestionLayout").addEventListener("click",()=>questionPatch({display_layout:getQuestionLayout()}));
async function questionPatch(patch){try{await teacherCall("update_question",{classroomId:classroom.id,questionId:activeQuestion.id,patch});await refresh();}catch(e){toast(e.message);}}
$("clearAnswers").addEventListener("click",async()=>{if(!activeQuestion)return toast("No active question.");if(!confirm("Clear all answers for this question?"))return;try{await teacherCall("clear_answers",{classroomId:classroom.id,questionId:activeQuestion.id});await refresh();toast("Answers cleared.");}catch(e){toast(e.message);}});
if(teacherToken){
  const savedRoomId=localStorage.getItem("hansali_classroom_id");
  if(savedRoomId){
    api("load",{teacherToken,classroomId:savedRoomId})
      .then(data=>loadRoom(data.classroom))
      .catch(()=>{localStorage.removeItem("hansali_teacher_token");localStorage.removeItem("hansali_classroom_id");teacherToken="";showStudio();});
  } else showStudio();
}
