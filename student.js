import { supabase } from "./supabase.js";
import { MEDIA_BUCKET } from "./config.js";
import { api, toast } from "./api.js";
import { showPresentation } from "./presentation.js";
const $=id=>document.getElementById(id);
let room=null,participantToken="",participantId="",currentQuestion=null,heartbeatTimer=null,refreshTimer=null;
const params=new URLSearchParams(location.search);
if(params.get("room"))$("joinCode").value=params.get("room");
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function mediaUrl(path){const {data,error}=await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
async function join(code,name){
 const r=await api("join_classroom",{roomCode:code,displayName:name});
 room=r.classroom;participantToken=r.token;participantId=r.participantId;

 try{
  $("classTitle").textContent=room.title.toUpperCase();
  $("studentRoomLabel").textContent=`ROOM / ${room.room_code}`;
  const ready=await refresh();
  if(!ready)throw new Error("This classroom has ended or was deleted.");
  $("joinScreen").classList.add("hidden");$("classroomScreen").classList.remove("hidden");
  if(refreshTimer)clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{if(room&&participantToken)refresh().catch(err=>toast(err.message,"studentToast"));},4000);
  if(heartbeatTimer)clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>api("participant_heartbeat",{participantToken}).catch(()=>{}),45000);
 }catch(err){
  if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
  if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
  participantToken="";participantId="";room=null;
  throw err;
 }
}
$("joinForm").addEventListener("submit",async e=>{e.preventDefault();$("joinError").textContent="Joining…";try{await join($("joinCode").value.trim(),$("studentName").value.trim());$("joinError").textContent="";}catch(e){$("joinError").textContent=e.message;}});
function showEndedClassroom(){
 if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
 if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
 participantToken="";participantId="";room=null;currentQuestion=null;
 $("classroomScreen").classList.add("hidden");$("joinScreen").classList.remove("hidden");
 $("joinError").textContent="This classroom has ended or was deleted by the teacher.";
}
async function refresh(){
 if(!room||!participantToken)return false;
 const data=await api("student_load",{participantToken});
 if(data.ended||!data.classroom||data.classroom.status!=="open"){
  showEndedClassroom();
  return false;
 }
 room=data.classroom;
 $("classTitle").textContent=room.title.toUpperCase();
 currentQuestion=data.question||null;
 renderContent(data.content||null,room.theme);
 renderQuestion(currentQuestion,room);
 renderWall(data.answers||[]);
 $("stageMode").textContent=room.current_mode.toUpperCase()+" MODE";
 return true;
}
function renderContent(c,theme={}){
 const host=$("teacherContent"),presentationPanel=$("presentationPanel");
 const isPresentation=c?.kind==="presentation";
 if(!isPresentation&&!presentationPanel.classList.contains("hidden")){
  presentationPanel.classList.add("hidden");
  $("presentationFrame").replaceChildren();
  delete $("presentationFrame").dataset.presentationUrl;
 }
 host.innerHTML="";
 if(!c){host.innerHTML='<p class="stage-placeholder">Your teacher is preparing the room.</p>';return;}
 if(c.kind==="text"){const el=document.createElement("div");el.className="content-text";el.textContent=c.payload.text||"";el.style.color=theme.foreground||"#152B45";host.append(el);}
 else if(c.kind==="image"){const img=document.createElement("img");img.className="content-image";img.alt=c.payload.name||"Classroom image";host.append(img);mediaUrl(c.payload.path||c.payload.url).then(url=>img.src=url).catch(()=>{});}
 else if(c.kind==="video"){const v=document.createElement("video");v.className="content-video";v.controls=true;v.playsInline=true;host.append(v);mediaUrl(c.payload.path||c.payload.url).then(url=>v.src=url).catch(()=>{});}
 else if(c.kind==="link"){const a=document.createElement("a");a.href=c.payload.url;a.target="_blank";a.rel="noopener";a.className="content-text";a.textContent=c.payload.url;host.append(a);}
 else if(c.kind==="canvas"){renderCanvas(host,c.payload?.document||{});}
 else if(c.kind==="presentation"){const panel=$("presentationPanel");panel.classList.remove("hidden");mediaUrl(c.payload.path||c.payload.url).then(url=>showPresentation($("presentationFrame"),url)).catch(()=>{});host.innerHTML=`<div class="stage-placeholder">PRESENTATION · ${escapeHtml(c.payload.name||"Slides")}</div>`;}
}

async function renderCanvas(host,documentData){
 const slides=Array.isArray(documentData.slides)?documentData.slides:[];
 const slide=slides.find(s=>s.id===documentData.activeSlideId)||slides[0];
 if(!slide){host.innerHTML='<p class="stage-placeholder">The teacher is preparing the presentation.</p>';return;}
 const stage=document.createElement("div");stage.className="student-canvas-slide";stage.style.background=slide.background||"#fff";
 const counter=document.createElement("div");counter.className="student-slide-counter";counter.textContent=(slides.indexOf(slide)+1)+" / "+slides.length;stage.append(counter);
 for(const item of (slide.elements||[])){
  const el=document.createElement("div");el.className="student-canvas-element";el.style.left=(Number(item.x||0)/1280*100)+"%";el.style.top=(Number(item.y||0)/720*100)+"%";el.style.width=(Number(item.w||100)/1280*100)+"%";el.style.height=(Number(item.h||80)/720*100)+"%";el.style.transform="rotate("+(Number(item.rotation)||0)+"deg)";el.style.opacity=String(item.opacity??1);
  if(item.type==="text"){el.classList.add("student-canvas-text");el.textContent=item.text||"";el.style.fontSize="clamp(8px,"+(Math.max(8,Number(item.fontSize)||36)/1280*100)+"cqw,90px)";el.style.color=item.color||"#172b45";el.style.fontFamily=item.fontFamily||"Arial";el.style.fontWeight=item.bold?"700":"400";el.style.textAlign=item.align||"left";}
  else if(item.type==="image"){const img=document.createElement("img");img.alt="Presentation image";img.style.objectFit=item.fit==="cover"?"cover":"contain";el.append(img);if(item.path)mediaUrl(item.path).then(url=>img.src=url).catch(()=>{});}
  else{el.classList.add("student-canvas-shape");el.style.background=item.fill||"#4169e1";el.style.borderRadius=item.shape==="circle"?"50%":"0";}
  stage.append(el);
 }
 host.append(stage);
}
function renderQuestion(q,r){
 const qBox=$("questionDisplay"),composer=$("answerComposer"),wallSection=$("answerWallSection");
 if(q&&!q.is_hidden){
  qBox.classList.remove("hidden");qBox.innerHTML="";
  const prompt=document.createElement("div");prompt.className="question-prompt";prompt.textContent=q.prompt;qBox.append(prompt);
  wallSection.classList.toggle("hidden",!q.show_answers);
  qBox.append(wallSection);
  composer.classList.toggle("hidden",!q.is_open||!r.submissions_enabled||!r.participation_enabled);
  $("answerText").disabled=!q.allow_text;
 }else{qBox.classList.add("hidden");wallSection.classList.add("hidden");composer.classList.add("hidden");}
}
function renderWall(items){
 $("wallCount").textContent=items.length+" IDEAS";
 $("answerWall").innerHTML=items.map((a,i)=>'<article class="answer-card '+(a.is_highlighted?"highlight":"") + '" style="--tilt:'+(((i%5)-2)*1.1)+'deg"><p>'+escapeHtml(a.text_content||"") + '</p>'+(room?.identities_visible&&a.display_name?'<small>'+escapeHtml(a.display_name)+'</small>':"")+'</article>').join("");
}
$("answerForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentQuestion)return;const btn=e.submitter;btn.disabled=true;$("answerFeedback").textContent="Sending…";try{await api("submit_answer",{participantToken,questionId:currentQuestion.id,text:$("answerText").value});$("answerText").value="";$("answerFeedback").textContent="Your answer has been shared.";toast("Answer sent.","studentToast");}catch(e){$("answerFeedback").textContent=e.message;}finally{btn.disabled=false;}});
$("expandPresentation").addEventListener("click",()=>$("presentationPanel").classList.toggle("floating"));
$("fullscreenPresentation").addEventListener("click",()=>{const el=$("presentationPanel");if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.();});
// Student access is intentionally not persisted: every page visit requires the room code.
sessionStorage.removeItem("hansali_participant");
