import { supabase } from "./supabase.js";
import { api, toast, uploadMedia } from "./api.js";
import { watchClassroom } from "./classroom.js";
import { showPresentation } from "./presentation.js";
const $=id=>document.getElementById(id);
let room=null,participantToken="",participantId="",stopWatch=null,currentQuestion=null;
const params=new URLSearchParams(location.search);
if(params.get("room"))$("joinCode").value=params.get("room");
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function mediaUrl(path){const {data,error}=await supabase.storage.from("hanssali-media").createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
async function join(code,name){const r=await api("join_classroom",{roomCode:code,displayName:name});room=r.classroom;participantToken=r.token;participantId=r.participantId;sessionStorage.setItem("hansali_participant",JSON.stringify({token:participantToken,room:room.room_code,participantId}));$("joinScreen").classList.add("hidden");$("classroomScreen").classList.remove("hidden");$("classTitle").textContent=room.title.toUpperCase();$("studentRoomLabel").textContent=`ROOM / ${room.room_code}`;await refresh();if(stopWatch)stopWatch();stopWatch=watchClassroom(supabase,room.id,()=>refresh().catch(()=>{}));setInterval(()=>api("participant_heartbeat",{participantToken}).catch(()=>{}),45000);}
$("joinForm").addEventListener("submit",async e=>{e.preventDefault();$("joinError").textContent="Joining…";try{await join($("joinCode").value.trim(),$("studentName").value.trim());$("joinError").textContent="";}catch(e){$("joinError").textContent=e.message;}});
async function refresh(){
 const [roomRes,contentRes,questionRes,wallRes]=await Promise.all([
  supabase.from("classrooms").select("*").eq("id",room.id).maybeSingle(),
  supabase.from("classroom_content").select("*").eq("classroom_id",room.id).eq("is_active",true).order("created_at",{ascending:false}).limit(1),
  supabase.from("questions").select("*").eq("classroom_id",room.id).order("created_at",{ascending:false}).limit(1)
 ]);
 if(roomRes.data)room=roomRes.data;
 $("classTitle").textContent=room.title.toUpperCase();
 const content=contentRes.data?.[0];currentQuestion=questionRes.data?.[0]||null;
 const wallRes=currentQuestion?await supabase.from("answer_wall_items").select("*").eq("classroom_id",room.id).eq("question_id",currentQuestion.id).order("created_at",{ascending:false}).limit(50):{data:[]};
 renderContent(content,room.theme);
 renderQuestion(currentQuestion,room);
 renderWall(wallRes.data||[]);
 $("stageMode").textContent=room.current_mode.toUpperCase()+" MODE";
}
function renderContent(c,theme={}){
 const host=$("teacherContent");host.innerHTML="";
 if(!c){host.innerHTML='<p class="stage-placeholder">Your teacher is preparing the room.</p>';return;}
 if(c.kind==="text"){const el=document.createElement("div");el.className="content-text";el.textContent=c.payload.text||"";el.style.color=theme.foreground||"#152B45";host.append(el);}
 else if(c.kind==="image"){const img=document.createElement("img");img.className="content-image";img.alt=c.payload.name||"Classroom image";host.append(img);mediaUrl(c.payload.path||c.payload.url).then(url=>img.src=url).catch(()=>{});}
 else if(c.kind==="video"){const v=document.createElement("video");v.className="content-video";v.controls=true;v.playsInline=true;host.append(v);mediaUrl(c.payload.path||c.payload.url).then(url=>v.src=url).catch(()=>{});}
 else if(c.kind==="link"){const a=document.createElement("a");a.href=c.payload.url;a.target="_blank";a.rel="noopener";a.className="content-text";a.textContent=c.payload.url;host.append(a);}
 else if(c.kind==="presentation"){const panel=$("presentationPanel");panel.classList.remove("hidden");mediaUrl(c.payload.path||c.payload.url).then(url=>showPresentation($("presentationFrame"),url)).catch(()=>{});host.innerHTML=`<div class="stage-placeholder">PRESENTATION · ${escapeHtml(c.payload.name||"Slides")}</div>`;}
}
function renderQuestion(q,r){
 const qBox=$("questionDisplay"),composer=$("answerComposer");
 if(q){qBox.classList.remove("hidden");qBox.innerHTML="";const prompt=document.createElement("div");prompt.textContent=q.prompt;qBox.append(prompt);if(q.attachment_path){const image=document.createElement("img");image.alt="Question attachment";mediaUrl(q.attachment_path).then(url=>image.src=url).catch(()=>{});image.style.maxWidth="min(100%,420px)";image.style.maxHeight="260px";image.style.objectFit="contain";image.style.marginTop="16px";qBox.append(image);}composer.classList.toggle("hidden",!q.is_open||!r.submissions_enabled||!r.participation_enabled);$("answerText").disabled=!q.allow_text;$("answerImage").disabled=!q.allow_image;$("answerLink").disabled=!q.allow_link;}
 else{qBox.classList.add("hidden");composer.classList.add("hidden");}
 $("answerWallSection").classList.toggle("hidden",!q?.show_answers);
}
function renderWall(items){
 $("wallCount").textContent=`${items.length} IDEAS`;
 $("answerWall").innerHTML=items.map((a,i)=>`<article class="answer-card ${a.is_highlighted?"highlight":""}" style="--tilt:${((i%5)-2)*1.1}deg"><p>${escapeHtml(a.text_content||"")}</p>${a.image_path?`<img data-media-path="${escapeHtml(a.image_path)}" alt="Student attachment">`:""}${a.link_url?`<a href="${escapeHtml(a.link_url)}" target="_blank" rel="noopener">Open shared link ↗</a>`:""}${room?.identities_visible&&a.display_name?`<small>${escapeHtml(a.display_name)}</small>`:""}</article>`).join("");
 [...document.querySelectorAll("#answerWall [data-media-path]")].forEach(img=>mediaUrl(img.dataset.mediaPath).then(url=>img.src=url).catch(()=>{}));
}
$("answerForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentQuestion)return;const btn=e.submitter;btn.disabled=true;$("answerFeedback").textContent="Sending…";try{let imagePath=null;const file=$("answerImage").files[0];if(file){const up=await uploadMedia(file,{classroomId:room.id,participantToken,questionId:currentQuestion.id});imagePath=up.path;}await api("submit_answer",{participantToken,questionId:currentQuestion.id,text:$("answerText").value,imagePath,linkUrl:$("answerLink").value});$("answerText").value="";$("answerImage").value="";$("answerLink").value="";$("answerFeedback").textContent="Your answer has been shared.";toast("Answer sent.","studentToast");}catch(e){$("answerFeedback").textContent=e.message;}finally{btn.disabled=false;}});
$("expandPresentation").addEventListener("click",()=>$("presentationPanel").classList.toggle("floating"));
$("fullscreenPresentation").addEventListener("click",()=>{const el=$("presentationPanel");if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.();});
const saved=JSON.parse(sessionStorage.getItem("hansali_participant")||"null");
if(saved?.token&&saved.room){api("resume_participant",{participantToken:saved.token}).then(async r=>{participantToken=saved.token;participantId=r.participantId;room=r.classroom;$("joinScreen").classList.add("hidden");$("classroomScreen").classList.remove("hidden");$("classTitle").textContent=room.title.toUpperCase();$("studentRoomLabel").textContent="ROOM / "+room.room_code;await refresh();stopWatch=watchClassroom(supabase,room.id,()=>refresh().catch(()=>{}));setInterval(()=>api("participant_heartbeat",{participantToken}).catch(()=>{}),45000);}).catch(()=>sessionStorage.removeItem("hansali_participant"));}
