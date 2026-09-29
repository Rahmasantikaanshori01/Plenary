document.addEventListener("DOMContentLoaded",()=>{
const colors=["#C599B6","#E6B2BA","#FAD0C4","#B36F91","#8E79B0","#DF907C","#7D9CC4","#B96EAE"];
document.querySelectorAll("[data-letter-hover]").forEach(el=>{
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const frag=document.createDocumentFragment();
    [...node.textContent].forEach((ch,i)=>{
      const s=document.createElement("span");s.className="letter";s.textContent=ch===" "?"\u00a0":ch;
      s.dataset.color=colors[i%colors.length];s.style.setProperty("--letter-color",s.dataset.color);s.style.setProperty("--rot",`${i%2?-2:2}deg`);
      frag.appendChild(s);
    });node.parentNode.replaceChild(frag,node);
  });
});
const glow=document.getElementById("mouseGlow");
document.addEventListener("mousemove",e=>{
  if(glow){glow.style.left=e.clientX+"px";glow.style.top=e.clientY+"px"}
  document.querySelectorAll(".interactive-text .letter").forEach(ch=>{
    const r=ch.getBoundingClientRect(),d=Math.hypot(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2));
    ch.classList.toggle("near",d<85);ch.classList.toggle("hot",d<28);
    if(d<28)ch.style.setProperty("--letter-color",colors[Math.floor(Math.random()*colors.length)]);
  });
});
document.querySelectorAll(".tilt").forEach(card=>{
 card.addEventListener("mousemove",e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(800px) rotateX(${y*-8}deg) rotateY(${x*9}deg) rotate(4deg) scale(1.025)`});
 card.addEventListener("mouseleave",()=>card.style.transform="rotate(7deg)");
});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("show");io.unobserve(e.target)}}),{threshold:.1});
document.querySelectorAll(".reveal").forEach(x=>io.observe(x));
document.querySelectorAll("[data-target]").forEach(x=>x.addEventListener("click",e=>{e.preventDefault();document.querySelector(x.dataset.target)?.scrollIntoView({behavior:"smooth"})}));
document.querySelectorAll(".category").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".category").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
 const cat=btn.dataset.cat;document.querySelectorAll(".event").forEach(card=>card.style.display=(cat==="all"||card.dataset.cat.includes(cat))?"":"none");
 document.getElementById("explore").scrollIntoView({behavior:"smooth"});
}));
let toast=document.getElementById("toast");const show=t=>{toast.textContent=t;toast.classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>toast.classList.remove("show"),1800)};
document.querySelectorAll(".heart").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();x.textContent=x.textContent==="♡"?"♥":"♡";show(x.textContent==="♥"?"Event disimpan ke favorit.":"Event dihapus dari favorit.")}));
document.querySelectorAll(".add").forEach(x=>x.addEventListener("click",()=>show("Detail tiket siap dihubungkan ke backend.")));
document.getElementById("focusSearch")?.addEventListener("click",()=>{document.getElementById("searchBox").scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("eventSearch").focus()});
document.getElementById("menuBtn")?.addEventListener("click",()=>{const nav=document.querySelector(".nav nav");nav.classList.toggle("open")});
});

