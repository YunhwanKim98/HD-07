
const SUPABASE_URL="https://hcicdayrrebiijzmsjzb.supabase.co";
const SUPABASE_KEY="sb_publishable_evArKRZ_DEhz9DX5qxYO2A_0at-4u3D";
const supabase = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
const hasSupabase = !!supabase;

const boards={
notice:{title:"공지사항",kicker:"NOTICE",desc:"프로젝트의 주요 소식을 웹진형 피드로 확인하세요."},
free:{title:"자유게시판",kicker:"COMMUNITY",desc:"아이디어와 의견을 자유롭게 나누세요."},
archive:{title:"자료실",kicker:"ARCHIVE",desc:"프로젝트 문서와 참고자료를 한곳에서 관리합니다."},
gallery:{title:"갤러리",kicker:"GALLERY",desc:"프로젝트 현장의 순간을 기록합니다."}
};
let currentBoard="notice", currentUser=null, currentProfile=null, editingId=null;

const $=id=>document.getElementById(id);
function toast(m){$("toast").textContent=m;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2800)}
function openModal(id){$(id).classList.add("open")} function closeModal(id){$(id).classList.remove("open")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function fmt(d){return d?new Date(d).toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}):""}
function go(type){if(type==="home"){$("home").scrollIntoView({behavior:"smooth"});return;}currentBoard=type;updateBoardHeader();if(hasSupabase){loadBoard();}else{$("boardPanel").innerHTML='<div class="empty">Supabase 연결이 필요합니다. 네트워크를 확인하세요.</div>';}$("boardArea").scrollIntoView({behavior:"smooth"})}
function updateBoardHeader(){const c=boards[currentBoard];$("boardKicker").textContent=c.kicker;$("boardTitle").textContent=c.title;$("boardDesc").textContent=c.desc;document.querySelectorAll("[data-board]").forEach(b=>b.classList.toggle("active",b.dataset.board===currentBoard))}
function setAuthMode(mode){
 $("signupTab").classList.toggle("active",mode==="signup");
 $("loginTab").classList.toggle("active",mode==="login");
 $("authName").classList.toggle("hidden",mode==="login");
 $("authTitle").textContent=mode==="signup"?"직원 회원가입":"로그인";
 $("authSubmit").textContent=mode==="signup"?"회원가입":"로그인";
 $("authSubmit").dataset.mode=mode;
 $("authEmail").focus();
}
function openAuth(){setAuthMode("signup");openModal("authModal")}
async function submitAuth(){
 if(!hasSupabase){
   toast("현재 회원가입/로그인이 지원되지 않습니다.");
   return;
 }
 try{
   const mode=$("authSubmit").dataset.mode||"signup";
   const email=$("authEmail").value.trim();
   const password=$("authPassword").value;
   const name=$("authName").value.trim();

   if(!email)return toast("이메일을 입력하세요.");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast("올바른 이메일 주소를 입력하세요.");
   if(password.length<6)return toast("비밀번호는 6자 이상이어야 합니다.");

   $("authSubmit").disabled=true;
   $("authSubmit").textContent="처리 중...";

   let r;
   if(mode==="signup"){
     const redirectTo=location.protocol==="file:" ? undefined : location.origin + location.pathname;
     r=await supabase.auth.signUp({
       email,
       password,
       options:{
         data:{display_name:name||email.split("@")[0]},
         ...(redirectTo ? {emailRedirectTo:redirectTo} : {})
       }
     });
     if(r.error) throw r.error;
     closeModal("authModal");
     toast(r.data?.session ? "회원가입 및 로그인 완료" : "가입 완료! 이메일 인증 링크를 확인해 주세요.");
     await refreshUser();
   }else{
     r=await supabase.auth.signInWithPassword({email,password});
     if(r.error) throw r.error;
     closeModal("authModal");
     toast("로그인되었습니다.");
     await refreshUser();
   }
 }catch(e){
   console.error("AUTH ERROR",e);
   toast("회원가입/로그인 오류: "+(e?.message||"알 수 없는 오류"));
 }finally{
   $("authSubmit").disabled=false;
   const mode=$("authSubmit").dataset.mode||"signup";
   $("authSubmit").textContent=mode==="signup"?"회원가입":"로그인";
 }
}
async function logout(){await supabase.auth.signOut();toast("로그아웃되었습니다.");await refreshUser()}
async function refreshUser(){
 const {data}=await supabase.auth.getUser();currentUser=data.user||null;
 if(currentUser){
   const {data:p}=await supabase.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();currentProfile=p;
   $("userLabel").textContent=p?.display_name||currentUser.user_metadata?.display_name||currentUser.email;
   $("authButton").textContent="로그아웃";$("authButton").onclick=logout;
   $("adminBar").classList.toggle("hidden",p?.role!=="admin");
   if(p?.role==="admin")$("adminBar").innerHTML="<b>관리자 모드</b> · 공지/자료/갤러리 게시물 관리 및 삭제가 가능합니다.";
 }else{$("userLabel").textContent="게스트";$("authButton").textContent="회원가입 / 로그인";$("authButton").onclick=openAuth;$("adminBar").classList.add("hidden")}
 loadStats();
}
async function loadStats(){
 const {count}=await supabase.from("posts").select("id",{count:"exact",head:true});$("statPosts").textContent=count??0;
 const {count:mc}=await supabase.from("profiles").select("id",{count:"exact",head:true});$("statMembers").textContent=mc??"-";
}
function canEdit(p){return currentUser && (p.user_id===currentUser.id || currentProfile?.role==="admin")}
async function loadBoard(){
 updateBoardHeader();
 let q=supabase.from("posts").select("id,board_type,title,body,image_url,file_url,file_name,file_size,user_id,author_name,created_at,updated_at").eq("board_type",currentBoard).order("created_at",{ascending:false});
 const {data,error}=await q;
 if(error){$("boardPanel").innerHTML='<div class="empty">DB 설정이 필요합니다. 아래 제공된 supabase.sql을 먼저 실행하세요.</div>';return}
 renderBoard(data||[]);
}
function renderBoard(data){
 const search=(($("search")||{}).value||"").toLowerCase();
 const rows=data.filter(p=>(p.title+" "+(p.body||"")).toLowerCase().includes(search));
 $("statPosts").textContent=data.length;
 if(currentBoard==="gallery"){
   $("boardPanel").innerHTML=`<div class="toolbar"><input id="search" class="input" placeholder="갤러리 검색" value="${esc(search)}" oninput="renderBoard(${JSON.stringify(data).replace(/</g,"\\u003c")})"><button class="mini" onclick="loadBoard()">새로고침</button></div><div class="gallery">${rows.length?rows.map(cardGallery).join(""):'<div class="empty" style="grid-column:1/-1">등록된 사진이 없습니다.</div>'}</div>`;
 }else if(currentBoard==="notice"){
   const featured=rows[0];
   $("boardPanel").innerHTML=`<div class="toolbar"><input id="search" class="input" placeholder="공지 검색" value="${esc(search)}" oninput="renderBoard(${JSON.stringify(data).replace(/</g,"\\u003c")})"><button class="mini" onclick="loadBoard()">새로고침</button></div><div class="webzine"><div class="feature">${featured?`<span class="kicker" style="color:#9ceaff">FEATURED</span><h3>${esc(featured.title)}</h3><p>${esc(featured.body||"")}</p><div class="meta" style="color:#cbdcff">${fmt(featured.created_at)}</div><button class="btn" style="margin-top:18px" onclick="detail('${featured.id}')">자세히 보기</button>`:'<h3>첫 공지를 등록해 보세요.</h3><p>프로젝트의 핵심 소식을 웹진처럼 보여줍니다.</p>'}</div><div>${rows.slice(1).map(p=>`<div class="sidepost"><b>${esc(p.title)}</b><div class="meta">${fmt(p.created_at)}</div><button class="mini" style="margin-top:8px" onclick="detail('${p.id}')">보기</button></div>`).join("")||'<div class="empty">추가 공지가 없습니다.</div>'}</div></div>`;
 }else{
   $("boardPanel").innerHTML=`<div class="toolbar"><input id="search" class="input" placeholder="${currentBoard==="archive"?"자료":"게시물"} 검색" value="${esc(search)}" oninput="renderBoard(${JSON.stringify(data).replace(/</g,"\\u003c")})"><button class="mini" onclick="loadBoard()">새로고침</button></div><div>${rows.length?rows.map(cardPost).join(""):'<div class="empty">게시물이 없습니다.</div>'}</div>`;
 }
}
function actions(p){return canEdit(p)?`<div class="postActions"><button class="mini" onclick="editPost('${p.id}')">수정</button><button class="mini danger" onclick="deletePost('${p.id}')">삭제</button></div>`:""}
function cardPost(p){return `<article class="post"><div><h3>${esc(p.title)}</h3><p>${esc(p.body||"")}</p><div class="meta">${esc(p.author_name||"")} · ${fmt(p.created_at)} ${p.file_url?`· <a href="${esc(p.file_url)}" target="_blank" rel="noopener">파일 ${esc(p.file_name||"열기")}</a>`:""}</div></div><div>${actions(p)}<button class="mini" onclick="detail('${p.id}')">보기</button></div></article>`}
function cardGallery(p){return `<article class="tile">${p.image_url?`<img src="${esc(p.image_url)}" onerror="this.style.display='none'">`:""}<div class="cap"><h4>${esc(p.title)}</h4><p>${esc(p.body||"")}</p><div class="meta">${fmt(p.created_at)}</div><button class="mini" onclick="detail('${p.id}')">보기</button> ${actions(p)}</div></article>`}
async function detail(id){
 const {data:p,error}=await supabase.from("posts").select("*").eq("id",id).single();if(error)return toast(error.message);
 $("detailContent").innerHTML=`<div class="kicker">${esc(p.board_type)}</div><h2>${esc(p.title)}</h2><div class="meta">${esc(p.author_name||"")} · ${fmt(p.created_at)}</div>${p.image_url?`<img src="${esc(p.image_url)}" style="width:100%;max-height:420px;object-fit:cover;border-radius:10px;margin:18px 0">`:""}<p style="white-space:pre-wrap;line-height:1.8;color:#53617a">${esc(p.body||"")}</p>${p.file_url?`<p><a class="btn primary" href="${esc(p.file_url)}" target="_blank" rel="noopener">첨부파일 열기</a></p>`:""}`;
 openModal("detailModal");
}
function openPost(){
 if(!currentUser)return openAuth();
 editingId=null;$("postModalTitle").textContent=`새 글 작성 · ${boards[currentBoard].title}`;$("postTitle").value="";$("postBody").value="";$("fileArea").innerHTML="";
 if(currentBoard==="gallery")$("fileArea").innerHTML=`<input id="imageUrl" class="input" placeholder="이미지 URL (선택)"><div class="hint">Storage 업로드를 사용하려면 아래 파일 선택에서 이미지를 올릴 수 있습니다.</div><div class="drop">이미지 파일<input id="uploadFile" type="file" accept="image/*"></div>`;
 if(currentBoard==="archive")$("fileArea").innerHTML=`<div class="drop">자료 파일 선택<input id="uploadFile" type="file"></div>`;
 openModal("postModal");
}
async function editPost(id){
 const {data:p,error}=await supabase.from("posts").select("*").eq("id",id).single();if(error)return toast(error.message);
 if(!canEdit(p))return toast("수정 권한이 없습니다.");
 editingId=id;$("postModalTitle").textContent="게시물 수정";$("postTitle").value=p.title;$("postBody").value=p.body||"";
 $("fileArea").innerHTML=currentBoard==="gallery"?`<input id="imageUrl" class="input" placeholder="이미지 URL" value="${esc(p.image_url||"")}"><div class="drop">새 이미지<input id="uploadFile" type="file" accept="image/*"></div>`:currentBoard==="archive"?`<div class="drop">새 자료 파일<input id="uploadFile" type="file"></div>`:"";
 openModal("postModal");
}
async function savePost(){
 const title=$("postTitle").value.trim(),body=$("postBody").value.trim();if(!title)return toast("제목을 입력하세요.");
 let image_url=currentBoard==="gallery"?($("imageUrl")?.value.trim()||null):null,file_url=null,file_name=null,file_size=null;
 const file=$("uploadFile")?.files?.[0];
 if(file){
   const path=`${currentUser.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-가-힣 ]/g,"_")}`;
   const {error:up}=await supabase.storage.from("project-files").upload(path,file,{upsert:false});
   if(up)return toast("파일 업로드 실패: "+up.message);
   const {data:pub}=supabase.storage.from("project-files").getPublicUrl(path);
   file_url=pub.publicUrl;file_name=file.name;file_size=file.size;
   if(currentBoard==="gallery")image_url=file_url;
 }
 let result;
 if(editingId){
   result=await supabase.from("posts").update({title,body,image_url,file_url,file_name,file_size,updated_at:new Date().toISOString()}).eq("id",editingId);
 }else{
   result=await supabase.from("posts").insert({board_type:currentBoard,title,body,image_url,file_url,file_name,file_size,user_id:currentUser.id,author_name:currentProfile?.display_name||currentUser.user_metadata?.display_name||currentUser.email});
 }
 if(result.error)return toast(result.error.message);
 closeModal("postModal");toast(editingId?"수정되었습니다.":"등록되었습니다.");await loadBoard();loadStats();
}
async function deletePost(id){
 if(!confirm("이 게시물을 삭제할까요?"))return;
 const {error}=await supabase.from("posts").delete().eq("id",id);if(error)return toast(error.message);toast("삭제되었습니다.");loadBoard();loadStats();
}

var authForm = $("authForm");
if(authForm) {
  authForm.addEventListener("submit",function(e){
    e.preventDefault();
    submitAuth();
  });
}
var authButton = $("authButton");
if(authButton) {
  authButton.addEventListener("click",function(e){
    e.preventDefault();
    if(currentUser) logout();
    else openAuth();
  });
}
var boardButtons = document.querySelectorAll("[data-board]");
for(var i=0;i<boardButtons.length;i++){
  boardButtons[i].addEventListener("click",function(){
    go(this.dataset.board);
  });
}
if(hasSupabase && supabase.auth.onAuthStateChange){
  supabase.auth.onAuthStateChange(()=>setTimeout(refreshUser,0));
}
(async()=>{await refreshUser();updateBoardHeader();await loadBoard()})();
