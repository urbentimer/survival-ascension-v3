import { Client } from "https://cdn.jsdelivr.net/npm/colyseus.js@0.16.19/+esm";
import { GAME_SERVER } from "./config.js";

const $ = id => document.getElementById(id);
const serverInput = new URLSearchParams(location.search).get("server");
const defaultEndpoint = location.protocol === "https:" ? `wss://${location.host}` : `ws://${location.hostname || "localhost"}:2567`;
const endpoint = serverInput || GAME_SERVER || defaultEndpoint;
const client = new Client(endpoint);
let room = null, myId = "", state = null, keys = {}, lastInput = 0, lastShoot = 0, dashReady = true, paused = false;
const canvas = $("arena"), ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
const COLORS = ["#68d5e8", "#e8bd68", "#c58be8", "#82d49a", "#e88787", "#8eabed", "#e5a36b", "#d2d879"];
function loadProfile(){try{return JSON.parse(localStorage.getItem("survivalAscensionProfile")||"{}");}catch{return {};}}
let lastProfileSave=0;
function saveProfile(me){if(!me||Date.now()-lastProfileSave<3000)return;lastProfileSave=Date.now();try{localStorage.setItem("survivalAscensionProfile",JSON.stringify({level:me.level,xp:me.xp,xpNext:me.xpNext,maxHp:me.maxHp,damage:me.damage,fireRate:me.fireRate,speed:me.speed,defence:me.defence,currency:me.currency,characterClass:me.characterClass,weapon:me.weapon,melee:me.melee,highestWave:Math.max(Number(loadProfile().highestWave)||1,state?.stage||1)}));}catch{}}
const upgrades = [ ["damage","Heavy weapon","+5 weapon damage"], ["fireRate","Rapid fire","+20% firing speed"], ["health","Vitality","+20 maximum HP and heal"], ["defence","Body armour","+2 defence"], ["speed","Adrenaline","+10% movement speed"] ];
function status(text, good=false){$("connection").textContent=text;$("connection").style.borderColor=good?"#4d9c68":"#8a6852";}
function message(text){$("lobbyMessage").textContent=text;$("gameMessage").textContent=text;}
function showOverlay(title,text){$("overlay").classList.remove("hidden");$("overlayTitle").textContent=title;$("overlayText").textContent=text;$("upgradeChoices").innerHTML="";$("nextStage").classList.add("hidden");}
function hideOverlay(){$("overlay").classList.add("hidden");}
function playerName(){return $("name").value.trim().slice(0,18)||"Survivor";}
async function createRoom(){try{status("Connecting…");room=await client.create("survival",{name:playerName(),profile:loadProfile()});connected();}catch(e){status("Connection failed");message(e.message||"Could not create room. Check the server URL and try again.");}}
async function joinRoom(){const code=$("roomCode").value.trim();if(!code)return message("Enter the invitation code first.");try{status("Joining…");room=await client.joinById(code,{name:playerName(),profile:loadProfile()});connected();}catch(e){status("Join failed");message(e.message||"Could not join room. Check the code and server.");}}
function connected(){myId=room.sessionId;status("Connected · "+room.roomId,true);$("lobby").classList.remove("hidden");$("gameArea").classList.remove("hidden");$("invite").classList.remove("hidden");$("codeDisplay").textContent=room.roomId;$("roomCount").textContent="Room connected";message("Connected. Share the invitation code with your friends.");
 room.onStateChange(s=>{state=s;renderState();});
 room.onLeave(code=>{status("Disconnected");message("You left the room ("+code+").");room=null;$("gameArea").classList.add("hidden");$("lobby").classList.remove("hidden");});
 room.onError((code,msg)=>message("Room error: "+msg));
}
document.addEventListener("click",e=>{const b=e.target.closest?.("button");if(b)b.blur();});
$("create").onclick=createRoom;$("join").onclick=joinRoom;
$("copy").onclick=async()=>{try{await navigator.clipboard.writeText(room.roomId);$("copy").textContent="Copied!";}catch{$("copy").textContent="Code: "+room.roomId;}};
$("startGame").onclick=()=>room?.send("start");$("nextStage").onclick=()=>room?.send("nextStage");
$("selectClass").onclick=()=>room?.send("chooseClass",{id:$("classPick").value});
$("equipWeapon").onclick=()=>room?.send("weapon",{id:$("weaponPick").value});$("equipMelee").onclick=()=>room?.send("meleeEquip",{id:$("meleePick").value});
$("useAbility").onclick=()=>room?.send("ability");
$("meleeAttack").onclick=()=>room?.send("melee");
$("leave").onclick=()=>room?.leave();
$("repairTower").onclick=()=>room?.send("repairTower",{amount:250});
$("repairGen").onclick=()=>room?.send("repairGenerator");
$("refuelGen").onclick=()=>room?.send("refuelGenerator");
document.querySelectorAll("[data-build]").forEach(b=>b.onclick=()=>{
 const me=state?.players.get(myId); if(me) room?.send("build",{kind:b.dataset.build,x:me.x+35,y:me.y+15});
});
function renderState(){if(!state||!room)return;
 const players=[...state.players.values()],me=state.players.get(myId),host=state.hostId===myId;saveProfile(me);
 $("lobbyPlayers").innerHTML=players.map(p=>`<span class="pill">${escapeHtml(p.name)} ${p.isHost?"★":""}</span>`).join("");
 $("team").innerHTML=players.map(p=>`<span class="pill" style="border-color:${p.color}">${escapeHtml(p.name)} · ${p.alive?Math.ceil(p.hp)+" HP":"DOWN"} · Lv.${p.level}</span>`).join("");
 $("roomCount").textContent=players.length+" / 8 survivors";
 $("startGame").classList.toggle("hidden",!host||state.phase!=="lobby");
 $("stage").textContent=state.stage;$("level").textContent=me?.level||1;$("hp").textContent=me?Math.ceil(me.hp)+" / "+me.maxHp:"—";$("loadoutText").textContent=me?`${me.characterClass.toUpperCase()} · ${me.weapon.toUpperCase()} · ${me.ammo} ammo · ${me.melee||"knife"} · Ability cooldown ${Math.ceil(me.abilityCooldown||0)}s · ${me.currency||0} credits`:"Choose a survivor class.";$("gold").textContent=me?me.kills*2:0;$("kills").textContent=me?.kills||0;
 $("xpText").textContent=me?me.xp+" / "+me.xpNext:"0 / 30";$("xpBar").style.width=me?Math.min(100,me.xp/me.xpNext*100)+"%":"0%";
 $("towerText").textContent=Math.ceil(state.towerHp||0)+" / "+(state.towerMaxHp||10000)+" HP";
 $("towerBar").style.width=Math.max(0,(state.towerHp||0)/(state.towerMaxHp||10000)*100)+"%";
 $("towerBar").style.background=(state.towerHp||0)<2500?"#e45b4d":"#58ce8b";
 $("generatorText").textContent=Math.ceil(state.generatorFuel||0)+"% fuel · "+Math.ceil(state.generatorHp||0)+" HP";
 $("generatorBar").style.width=Math.max(0,(state.generatorHp||0)/(state.generatorMaxHp||1200)*100)+"%";
 $("resources").textContent=`Scrap ${Math.floor(state.scrap||0)} · Electronics ${Math.floor(state.electronics||0)} · Explosives ${Math.floor(state.explosives||0)} · Fuel ${Math.floor(state.fuel||0)}`;
 $("clockLabel").textContent=state.isNight?"NIGHT":"DAY";

 const ranked=players.slice().sort((a,b)=>b.kills-a.kills || (a.killLeadSince||Number.MAX_SAFE_INTEGER)-(b.killLeadSince||Number.MAX_SAFE_INTEGER) || String(a.name).localeCompare(String(b.name)));
 const crownLeader=ranked.length?ranked[0]:null;
 const board=$("scoreboard");
 const rows=ranked.map((p,i)=>`<tr class="${i===0&&p.kills>0?"leader":""}"><td>${i===0&&p.kills>0?"👑 ":""}${i+1}. ${escapeHtml(p.name)}${p.sessionId===myId?" (YOU)":""}</td><td>${p.kills}</td><td>${Math.round(p.bossDamage||0)}</td><td>${p.revives||0}</td><td>${Math.round(p.towerRepairs||0)}</td><td>${p.structuresBuilt||0}</td><td>${Math.round(p.damageDealt||0)}</td><td>${Math.round(p.damageTaken||0)}</td></tr>`).join("");
 const finalAwards=["Zombie Slayer","Boss Hunter","Lifesaver","Guardian","Master Engineer","Sharpshooter"];
 const awardKeys=["kills","bossDamage","revives","towerRepairs","structuresBuilt","headshots"];
 const awards=finalAwards.map((label,i)=>{const winner=players.slice().sort((a,b)=>(Number(b[awardKeys[i]])||0)-(Number(a[awardKeys[i]])||0))[0];return winner&&Number(winner[awardKeys[i]])>0?`${label}: ${escapeHtml(winner.name)}`:"";}).filter(Boolean);
 board.innerHTML=`<h3>${["cleared","victory","defeat"].includes(state.phase)?"MATCH RESULTS":"LIVE KILL LEADERBOARD"}</h3><table><thead><tr><th>Survivor</th><th>Kills</th><th>Boss dmg</th><th>Revives</th><th>Tower repair</th><th>Builds</th><th>Damage dealt</th><th>Damage taken</th></tr></thead><tbody>${rows}</tbody></table>${["cleared","victory","defeat"].includes(state.phase)?`<div class="scorehint">${awards.join(" · ")}</div>`:""}<div class="scorehint">Team kills: ${state.totalKills||0} · Press TAB to toggle</div>`;
 board.classList.toggle("hidden",!scoreboardOpen && !["cleared","victory","defeat"].includes(state.phase));

 $("gameMessage").textContent=state.message;
 if(state.phase==="lobby"){showOverlay("Waiting for host","Share code "+state.roomCode+" with friends. The host can start when ready.");}
 else if(state.phase==="cleared"){showOverlay("WAVE "+state.stage+" CLEARED!","The team survived. The host can launch the next wave.");$("nextStage").textContent="START WAVE "+(state.stage+1);$("nextStage").classList.toggle("hidden",!host);}
 else if(state.phase==="victory"){showOverlay("CAMPAIGN COMPLETE!","You survived all 50 waves and defeated the final boss. Victory!");}
 else if(state.phase==="defeat"){showOverlay("TEAM DEFEATED","The radio tower was destroyed or the entire team was downed.");}
 else if(state.phase==="playing"){
  if(me&&!me.alive)showOverlay("YOU ARE DOWN",`Bleed-out in ${Math.ceil(me.bleedout||0)} seconds. A teammate can come close and press E to revive you.`);
  else if(me && me.xp >= me.xpNext) showUpgradeChoices(me);
  else hideOverlay();
 }
}

function showUpgradeChoices(me){
 if($("overlayTitle").textContent==="LEVEL UP!") return;
 showOverlay("LEVEL UP!", "Choose one upgrade. Your XP is spent when you select it.");
 const box=$("upgradeChoices");
 for(const [id,title,desc] of upgrades){
  const b=document.createElement("button");b.className="button upgrade";b.innerHTML=`<b>${title}</b><div class="muted" style="font-size:12px;margin-top:4px">${desc}</div>`;
  b.onclick=()=>{room?.send("upgrade",{id});$("upgradeChoices").innerHTML="<span class='muted'>Upgrade selected…</span>";};box.appendChild(b);
 }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function aimAngle(me){return Math.atan2(mouse.y-me.y,mouse.x-me.x);}
let mouse={x:W/2,y:H/2};
let audioContext=null, ambientGain=null, ambientOn=false;
function toggleAmbient(){
 if(!audioContext){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioContext=new AC();ambientGain=audioContext.createGain();ambientGain.gain.value=0;ambientGain.connect(audioContext.destination);
  [55,82.4,110].forEach((freq,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=i===1?"triangle":"sine";o.frequency.value=freq;o.detune.value=(i-1)*7;g.gain.value=[.18,.07,.04][i];o.connect(g);g.connect(ambientGain);o.start();});
 }
 ambientOn=!ambientOn;ambientGain.gain.setTargetAtTime(ambientOn?.16:0,audioContext.currentTime,.8);$("musicToggle").textContent="Ambient music: "+(ambientOn?"ON":"OFF");
}
$("musicToggle").onclick=toggleAmbient;
let scoreboardOpen=false;
canvas.addEventListener("mousemove",e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height;});
window.addEventListener("keydown",e=>{if(e.target.closest?.("input,select,textarea"))return;const k=e.key.toLowerCase();if(k==="tab"){e.preventDefault();scoreboardOpen=!scoreboardOpen;if(state?.phase!=="cleared")$("scoreboard").classList.toggle("hidden",!scoreboardOpen);}if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k))e.preventDefault();keys[k===" "?"space":k]=true;if(k==="p")paused=!paused;if(k==="e")tryRevive();if(k==="q")room?.send("ability");if(k==="f")room?.send("melee");});
window.addEventListener("keyup",e=>{const k=e.key.toLowerCase();keys[k===" "?"space":k]=false;});
function tryRevive(){if(!state||!room)return;const me=state.players.get(myId);if(!me?.alive)return;const target=[...state.players.values()].find(p=>!p.alive&&Math.hypot(p.x-me.x,p.y-me.y)<85);if(target)room.send("revive",{targetId:target.sessionId});}
function sendControls(t){if(!room||!state||state.phase!=="playing"||paused)return;const me=state.players.get(myId);if(!me?.alive)return;const dt=Math.min(.1,(t-lastInput)/1000||.05);if(t-lastInput>45){const dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);room.send("input",{dx,dy,dt});lastInput=t;}if(t-lastShoot>170){room.send("shoot",{});lastShoot=t;}if(keys.space&&dashReady){dashReady=false;setTimeout(()=>dashReady=true,850);const dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);room.send("input",{dx:dx*2,dy:dy*2,dt:.12});keys.space=false;}}
function drawZombie(z){const skin=z.boss?"#8d3d3d":z.kind==="brute"?"#77664c":z.kind==="runner"?"#87946a":z.kind==="spitter"?"#61794d":z.kind==="mutant"?"#9b5b86":"#78866b";ctx.save();ctx.translate(z.x,z.y);if(z.boss)ctx.scale(1.4,1.4);ctx.fillStyle="#0a100d";ctx.beginPath();ctx.ellipse(0,5,z.radius*1.1,z.radius*.8,0,0,7);ctx.fill();ctx.strokeStyle=skin;ctx.lineWidth=z.kind==="brute"?11:6;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(-z.radius-8,10);ctx.moveTo(7,0);ctx.lineTo(z.radius+8,8);ctx.stroke();ctx.fillStyle=z.kind==="brute"?"#5e5947":"#48543f";ctx.beginPath();ctx.ellipse(0,4,z.radius*.75,z.radius,0,0,7);ctx.fill();ctx.fillStyle="#443a35";ctx.beginPath();ctx.moveTo(-z.radius*.7,-2);ctx.lineTo(z.radius*.7,-2);ctx.lineTo(z.radius*.45,z.radius+8);ctx.lineTo(-4,z.radius+6);ctx.closePath();ctx.fill();ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-z.radius*.7,z.radius*.63,0,7);ctx.fill();ctx.fillStyle="#c6e76d";ctx.shadowBlur=8;ctx.shadowColor="#a6d95d";ctx.beginPath();ctx.arc(-5,-z.radius*.72,2.5,0,7);ctx.arc(5,-z.radius*.72,2.5,0,7);ctx.fill();ctx.shadowBlur=0;if(z.boss){ctx.fillStyle="#c69c4a";ctx.beginPath();ctx.moveTo(-14,-z.radius);ctx.lineTo(-10,-z.radius-17);ctx.lineTo(-3,-z.radius);ctx.lineTo(5,-z.radius-20);ctx.lineTo(14,-z.radius);ctx.fill();}ctx.restore();ctx.fillStyle="#241f1c";ctx.fillRect(z.x-z.radius,z.y-z.radius-15,z.radius*2,4);ctx.fillStyle=z.boss?"#e44c4c":"#b5c26b";ctx.fillRect(z.x-z.radius,z.y-z.radius-15,z.radius*2*Math.max(0,z.hp/z.maxHp),4);if(z.boss){ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText(String(z.kind).replace(/[A-Z]/g,m=>" "+m.toUpperCase()).toUpperCase(),z.x,z.y-z.radius-21);}}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle="#17251c";ctx.fillRect(0,0,W,H);ctx.strokeStyle="#253a2b";ctx.lineWidth=1;for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}for(let i=0;i<35;i++){const x=(i*139+43)%W,y=(i*97+17)%H;ctx.fillStyle="#263d2c";ctx.beginPath();ctx.arc(x,y,8,0,7);ctx.fill();}if(state){
 // City streets and the protected radio tower landmark.
 ctx.fillStyle="#303a35";ctx.fillRect(0,H/2-75,W,150);ctx.fillRect(W/2-85,0,170,H);
 ctx.strokeStyle="#8a8a70";ctx.setLineDash([24,22]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
 ctx.save();ctx.translate(W/2,H/2);ctx.fillStyle="#5b6760";ctx.fillRect(-32,-32,64,64);ctx.fillStyle="#d9c27b";ctx.fillRect(-6,-56,12,26);ctx.fillStyle="#e5d78a";ctx.beginPath();ctx.arc(0,-58,7,0,7);ctx.fill();ctx.restore();
 for(const item of state.loot.values()){ctx.fillStyle=item.kind==="medkit"?"#e75a5a":item.kind==="ammo"?"#e2c65b":item.kind==="gold"?"#f5d66c":item.kind==="weapon"?"#d69cff":"#8abf9b";ctx.fillRect(item.x-6,item.y-6,12,12);ctx.strokeStyle="#18251e";ctx.strokeRect(item.x-6,item.y-6,12,12);}
 for(const st of state.structures.values()){ctx.save();ctx.translate(st.x,st.y);ctx.fillStyle=st.kind==="turret"?"#6d8492":st.kind==="fence"?"#75d9d1":st.kind==="mine"?"#bd6553":st.kind==="flameTrap"?"#e28a42":"#8b6748";ctx.fillRect(-14,-14,28,28);ctx.strokeStyle="#e3e8d9";ctx.strokeRect(-14,-14,28,28);ctx.restore();}
 for(const z of state.zombies.values())drawZombie(z);for(const p of state.players.values()){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=p.alive?p.color:"#555";ctx.shadowBlur=12;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(0,0,15,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#304d43";ctx.fillRect(-7,-9,14,18);ctx.restore();ctx.fillStyle="#fff";ctx.font="12px sans-serif";ctx.textAlign="center";ctx.fillText(p.name+(p.sessionId===myId?" (YOU)":""),p.x,p.y-23);const leader=[...state.players.values()].sort((a,b)=>b.kills-a.kills||(a.killLeadSince||Number.MAX_SAFE_INTEGER)-(b.killLeadSince||Number.MAX_SAFE_INTEGER)||String(a.name).localeCompare(String(b.name)))[0];if(leader&&leader.kills>0&&leader.sessionId===p.sessionId){ctx.save();ctx.font="bold 23px serif";ctx.textAlign="center";ctx.shadowColor="#ffd84d";ctx.shadowBlur=12;ctx.fillStyle="#ffd84d";ctx.fillText("♛",p.x,p.y-35);ctx.restore();}if(!p.alive){ctx.fillStyle="#ff7777";ctx.fillText("DOWN · E TO REVIVE",p.x,p.y+30);}}ctx.fillStyle="#d5e3d2";ctx.font="14px sans-serif";ctx.textAlign="left";ctx.fillText("ABANDONED CITY · WAVE "+state.stage+"/50",16,24);ctx.fillText("ZOMBIES: "+state.zombies.size+" · "+(state.isNight?"NIGHT":"DAY"),16,45);
 if(state.isNight){ctx.fillStyle="rgba(4,8,24,.28)";ctx.fillRect(0,0,W,H);}
 ctx.fillStyle="#e6e0c4";ctx.font="bold 12px sans-serif";ctx.fillText("RADIO TOWER",W/2-42,H/2+52);
 const mini=$("minimap"),m=mini.getContext("2d");m.clearRect(0,0,360,228);m.fillStyle="#101b15";m.fillRect(0,0,360,228);m.fillStyle="#354239";m.fillRect(0,99,360,30);m.fillRect(165,0,30,228);m.fillStyle="#d8bd70";m.fillRect(172,105,16,16);
 for(const st of state.structures.values()){m.fillStyle="#b58b56";m.fillRect(st.x/W*360-3,st.y/H*228-3,6,6);}
 for(const z of state.zombies.values()){m.fillStyle=z.boss?"#ff3434":"#a8bd78";m.fillRect(z.x/W*360-2,z.y/H*228-2,4,4);}
 for(const pl of state.players.values()){m.fillStyle=pl.color;m.beginPath();m.arc(pl.x/W*360,pl.y/H*228,4,0,Math.PI*2);m.fill();}
 }}
function frame(t){sendControls(t);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
