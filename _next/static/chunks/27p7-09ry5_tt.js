(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,34049,e=>{"use strict";let t=(0,e.i(56420).default)("cloud-rain",[["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"M16 14v6",key:"1j4efv"}],["path",{d:"M8 14v6",key:"17c4r9"}],["path",{d:"M12 16v6",key:"c8a4gj"}]]);e.s(["CloudRain",0,t],34049)},95925,e=>{"use strict";let t=(0,e.i(56420).default)("rotate-ccw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);e.s(["RotateCcw",0,t],95925)},7569,e=>{"use strict";let t=(0,e.i(56420).default)("toilet",[["path",{d:"M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18",key:"kc4kqr"}],["path",{d:"M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8",key:"1tqs57"}]]);e.s(["Toilet",0,t],7569)},15976,e=>{"use strict";var t=e.i(43476),r=e.i(71645),i=e.i(34049),a=e.i(67280),n=e.i(32781),l=e.i(28523),s=e.i(21357),o=e.i(95925),u=e.i(7569),c=e.i(47321),h=e.i(75157),f=e.i(49713),d=e.i(13415),m=e.i(95103),x=e.i(50737),p=e.i(98483),g=e.i(19568),v=e.i(82990),b=e.i(91765),w=e.i(97633),F=e.i(33585);let y=[{id:"ref",name:"Жишиг",i:40,d:60,shape:"uniform",note:"40 мм/ц · 1 цаг · тэгш"},{id:"strong",name:"Хүчтэй",i:50,d:45,shape:"tri",note:"50 мм/ц · 45 мин · оргилтой"},{id:"extreme",name:"Онц хүчтэй",i:80,d:60,shape:"front",note:"80 мм/ц · 1 цаг · эхэндээ хүчтэй"},{id:"slow",name:"Удаан",i:6,d:720,shape:"uniform",note:"6 мм/ц · 12 цаг · тэгш"}],M=2/3600,A={O:"lsand",T:"sloam",A:"sloam",A2:"loam",Ag:"cloam",Bw:"loam",Bk:"sil",Bg:"sicl",Bgk:"sicl",Bf:"loam",C:"sand",CR:"lsand",Cg:"sc",Cgk:"sc"},E={Cf:.001,R:.005},S=e=>{let t=e.split(/[_>]/)[0];return E[t]??w.TEX[A[t]??"loam"].Ks},R=e=>[e[0]*Math.PI*6378137/180,6378137*Math.log(Math.tan(Math.PI/4+e[1]*Math.PI/360))],T=(e,t)=>[e/6378137*(180/Math.PI),180/Math.PI*(2*Math.atan(Math.exp(t/6378137))-Math.PI/2)],_=e=>{let t=Math.round(e/60);return t<60?`${t} мин`:`${Math.floor(t/60)} ц ${String(t%60).padStart(2,"0")} мин`},j=e=>e>=100?Math.round(e).toLocaleString():e>=10?e.toFixed(1):e.toFixed(2);function C({icon:e,label:r,value:i,tone:a}){return(0,t.jsxs)("li",{className:"flex items-center gap-2 py-[5px]",children:[e?(0,t.jsx)(e,{size:13,className:a?"text-(--tone)":"text-ink-3"}):(0,t.jsx)("span",{className:"w-[13px]"}),(0,t.jsx)("span",{className:"min-w-0 flex-1 truncate text-[11.5px] text-ink-2",children:r}),(0,t.jsx)("b",{className:(0,h.cn)("num text-[12px] font-medium",a?"text-(--tone)":"text-ink"),children:i})]})}function P(e){let{st:r,t:i,playing:a,tNow:o}=e,u="ready"===r.phase;return(0,t.jsxs)("div",{className:"elevated absolute right-2 bottom-2 z-10 w-[400px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-sm",children:[(0,t.jsxs)("div",{className:"flex items-baseline justify-between gap-2",children:[(0,t.jsx)("span",{className:"text-[11.5px] font-semibold text-ink",children:"ҮЕР БА БОХИРДЛЫН ШИНГЭЭЛТ"}),(0,t.jsx)("span",{className:"num text-[11px] text-ink-3",children:r.area?`${r.area.latrines.toLocaleString()} нүхэн жорлон`:""})]}),u?(0,t.jsxs)("div",{className:"mt-1.5 flex items-center gap-2",children:[(0,t.jsxs)("button",{type:"button",onClick:e.onPlay,className:"flex items-center gap-1 rounded-xs border border-(--tone) px-2 py-1 text-[11.5px] text-ink",children:[a?(0,t.jsx)(l.Pause,{size:13}):(0,t.jsx)(s.Play,{size:13})," ",a?"Зогсоох":"Тоглуулах"]}),(0,t.jsx)("input",{type:"range",min:0,max:Math.max(0,r.frames-1),value:Math.min(i,Math.max(0,r.frames-1)),onChange:t=>e.onT(Number(t.target.value)),className:"min-w-0 flex-1 accent-(--tone)","aria-label":"Хугацаа"}),(0,t.jsx)("b",{className:"num w-[74px] text-right text-[12px] font-medium text-ink",children:_(o)})]}):(0,t.jsx)("div",{className:"mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-2",children:"error"===r.phase?(0,t.jsx)("span",{className:"text-(--clay)",children:r.message}):(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.Loader2,{size:12,className:"animate-spin text-ink-3"}),"loading"===r.phase?r.message:"Үерийн тооцоо явж байна"," · ",(0,t.jsxs)("span",{className:"num",children:[Math.round(100*r.progress),"%"]})]})}),(0,t.jsxs)("div",{className:"mt-1.5 grid grid-cols-2 gap-3",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("div",{className:"h-[8px] rounded-xs",style:{background:"linear-gradient(90deg,#9eebff,#40adff 7.5%,#1466e6 25%,#0d2ea6 50%,#380d73)"}}),(0,t.jsxs)("div",{className:"num mt-0.5 flex justify-between text-[10px] text-ink-3",children:[(0,t.jsx)("span",{children:"Усны гүн 0"}),(0,t.jsx)("span",{children:"1"}),(0,t.jsx)("span",{children:"2"}),(0,t.jsx)("span",{children:"4+ м"})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("div",{className:"flex h-[8px] overflow-hidden rounded-xs",children:[0,.25,.5,.75,1].map(e=>(0,t.jsx)("i",{className:"flex-1",style:{background:`rgb(${(0,F.rampC)(F.RN3,e)})`}},e))}),(0,t.jsxs)("div",{className:"num mt-0.5 flex justify-between text-[10px] text-ink-3",children:[(0,t.jsx)("span",{children:"Азот 1 мг/л"}),(0,t.jsx)("span",{children:"30"}),(0,t.jsx)("span",{children:"1000"})]})]})]})]})}e.s(["FloodSoilView",0,function(){let e=r.useRef(null),l=r.useRef(null),A=r.useRef(null),E=r.useRef(null),D=r.useRef(null),O=r.useRef(""),L=r.useCallback(e=>{D.current=e,e&&(e.textContent=O.current)},[]),[z,k]=r.useState("loading"),[B,H]=r.useState(""),[q,N]=r.useState(null),[I,G]=r.useState([]),[W,U]=r.useState(null),[Q,$]=r.useState(0),[K,X]=r.useState(!1);r.useEffect(()=>{let t=!0;return Promise.all([(0,x.fetchSoilProfile)(),(0,m.esriModules)(p.SOIL_MODULES)]).then(async([r,i])=>{if(!t||!e.current)return;let a=i[2],n=new a({title:"Үерийн ус",elevationInfo:{mode:"absolute-height"}}),s=new a({title:"Бохирдлын шингээлт",elevationInfo:{mode:"absolute-height"}}),o=await (0,p.createSoilScene)({container:e.current,data:r,mods:i,plumes:!1,layers:[n,s],onPick:()=>{},onNote:H,onSection:e=>{E.current=e,N(e)},onPlumes:()=>{},onScale:e=>{O.current=e?(0,h.ratioText)(e):"",D.current&&(D.current.textContent=O.current)},onLatrine:()=>{},onCut:e=>A.current?.setCut(e,E.current)});t?(l.current=o,A.current=function(e){let{geom:t}=e,r=null,i=null,a=!1,n=(0,w.fetchLatrineSim)().then(e=>(i=e,e),e=>(a=!0,console.warn("soil-flood: нүхэн жорлонгийн багц ирсэнгүй —",e instanceof Error?e.message:e),A({noLatrines:!0}),null)),l=null,s=0,o=null,u=null,c=y[0],h=[],f=0,d=1,m=null,x=null,p=null,g={phase:"idle",message:"",progress:0,area:null,frames:0,tEnd:0,preset:c.id,frame:0,stats:null,noLatrines:!1,cutOn:!1},A=t=>{Object.assign(g,t),e.onState({...g})};function E(){return r??=(0,b.loadFloodData)()}async function _(){let e,r=++s,o=c;A({phase:"loading",message:"Үерийн өгөгдөл ачаалж байна",progress:0,frames:0,stats:null,frame:0});try{e=await E(),!i&&(A({message:"Нүхэн жорлонгийн мэдээлэл ачаалж байна"}),await n,i||(i=await (0,w.fetchLatrineSim)().catch(()=>null)),i&&(a=!1))}catch(e){r===s&&A({phase:"error",message:e.message});return}if(r!==s)return;let u=e.meta;try{l??=(0,b.createSolverGL)()}catch(e){A({phase:"error",message:e.message});return}let g=new v.FloodSolver(l,e,{factor:6,buildings:!0}),{W:F,H:y,dx:S}=g,_=F*y,P=g.readTex("p"),D=g.readTex("gr"),O=g.readTex("wf"),z=new Float32Array(_),k=new Uint8Array(_),B=new Float32Array(_),H=new Float32Array(_),q=new Float32Array(_),N=new Float32Array(_),I=new Float32Array(_),G=new Float32Array(_);for(let e=0;e<_;e++){let t=P[4*e+3];z[e]=t>=.8?1:Math.max(1-t,.2),k[e]=+(t>=.8),B[e]=P[4*e+1],H[e]=P[4*e+2],q[e]=D[4*e+3],N[e]=D[4*e+1];let r=e%F,i=(e-r)/F;I[e]=r<F-1?Math.min(O[4*e],z[e]):z[e],G[e]=i<y-1?Math.min(O[4*e+1],z[e]):z[e]}let W=new Uint8Array(_);for(let e=0;e<_;e++){let r=e%F,i=(e-r)/F,[a,n]=T(g.x0+(r+.5)*g.cellMerc,g.y1-(i+.5)*g.cellMerc);W[e]=+!!t.validAt(a,n)}let U=new Uint16Array(_),Q=new Float32Array(_),$=0,K=0;if(i)for(let e=0;e<i.n;e++){let t=i.lon[e];if(!Number.isFinite(t))continue;let[r,a]=R([t,i.lat[e]]),n=Math.floor((r-g.x0)/g.cellMerc),l=Math.floor((g.y1-a)/g.cellMerc);if(n<0||l<0||n>=F||l>=y)continue;let s=l*F+n;U[s]++;let o=i.hh[e]/10;Q[s]+=o*w.N_PP*.5,$++,K+=o}m={W:F,H:y,x0:g.x0,y1:g.y1,cellMerc:g.cellMerc,dx:S,pc:z,valid:W},p=null,h=[],f=0,x=null;let X=3600*Math.max(3,o.d/60+1);A({phase:"running",message:"",progress:0,tEnd:X,frames:0,preset:o.id,noLatrines:!i,cutOn:!1,area:{kmW:u.W*u.res*u.groundScale/1e3,kmH:u.H*u.res*u.groundScale/1e3,w:F,h:y,dx:S,latrines:$,people:Math.round(K)}}),C();let Z=new Float32Array(_),V=new Float32Array(_),Y=Float32Array.from(Q),J=new Float32Array(_),ee=new Float32Array(_),et=new Float32Array(_),er=new Float32Array(_),ei=new Float32Array(4*_),ea=new Float32Array(4*_),en=0,el=0,es=0,eo=0,eu=0,ec=e=>({rain:(e=>{let t=60*o.d;if(e>=t)return 0;let r=o.i;if("tri"===o.shape){let i=.35*t;r=e<i?2*o.i*e/i:2*o.i*(t-e)/(t-i)}else"front"===o.shape&&(r=2*o.i*(1-e/t));return r/36e5})(e),rainArea:_*S*S,circle:[0,0,0,0],inflows:[],infMul:1,hortonK:M,tr:e,wet:eo,manning:1,theta:.8,drain:10,wallE:[1,0]}),eh=(e,t)=>{ei=g.readTex("h",ei),ea=g.readTex("q",ea),et.fill(0),er.fill(0);let r=1-Math.exp(-e/1200),i=0;for(let e=0;e<_;e++)if(U[e]&&ei[4*e]>.1){i+=U[e];let t=Y[e]*r;Y[e]-=t,Z[e]+=t,en+=t}for(let t=0;t<_;t++){let r=t%F,i=(t-r)/F,a=ea[4*t],n=ea[4*t+1];if(0!==a){let i=I[t]*a*S*e;if(i>0){let e=ei[4*t];e>1e-4&&Z[t]>0&&(et[t]=Math.min(1,i/(e*S*S*z[t])))}else if(r<F-1){let e=t+1,r=ei[4*e];r>1e-4&&Z[e]>0&&(et[t]=-Math.min(1,-i/(r*S*S*z[e])))}}if(0!==n){let r=G[t]*n*S*e;if(r>0){let e=ei[4*t];e>1e-4&&Z[t]>0&&(er[t]=Math.min(1,r/(e*S*S*z[t])))}else if(i<y-1){let e=t+F,i=ei[4*e];i>1e-4&&Z[e]>0&&(er[t]=-Math.min(1,-r/(i*S*S*z[e])))}}}ee.set(Z);for(let e=0;e<_;e++){if(Z[e]<=0)continue;let t=e%F,r=(e-t)/F,i=0;if(et[e]>0&&(i+=et[e]),er[e]>0&&(i+=er[e]),t>0&&et[e-1]<0&&(i-=et[e-1]),r>0&&er[e-F]<0&&(i-=er[e-F]),i<=0)continue;let a=Math.min(1,1/i),n=(t,r)=>{let i=Z[e]*t*a;ee[e]-=i,r>=0?ee[r]+=i:es+=i};et[e]>0&&n(et[e],t<F-1?e+1:-1),er[e]>0&&n(er[e],r<y-1?e+F:-1),t>0&&et[e-1]<0&&n(-et[e-1],e-1),r>0&&er[e-F]<0&&n(-er[e-F],e-F)}let a=Math.exp(-M*t),n=(e,r)=>(e*t+(r-e)*(1-a)/M)/3600,l=0,s=0,o=0,u=0;for(let t=0;t<_;t++){let r=ei[4*t];r>l&&(l=r),r>.02&&s++;let i=ee[t];if(r<=1e-4)i>0&&(V[t]+=i,i=0),Z[t]=i;else if(k[t])Z[t]=i;else{let l=(H[t]+(B[t]-H[t])*a)/36e5;if(q[t]>0){let e=Math.max(0,Math.min(1,(Math.min(eo,n(H[t],B[t]))/q[t]-.7)/.3));l*=1-.9*e*e*(3-2*e)}let s=Math.min(l*e,r);J[t]+=s;let o=Math.min(10/36e5*N[t]*e/r,1-s/r),u=s/r*i,c=i*o;V[t]+=u,el+=c,Z[t]=i-u-c}o+=Z[t],u+=V[t]}return{wetHa:s*S*S/1e4,flooded:i,washed:en,inWater:o,inSoil:u,drained:el,left:es,hmax:l,frontMax:0}},ef=(e,t)=>{let r=new Uint16Array(_),i=new Uint16Array(_),a=0;for(let e=0;e<_;e++)r[e]=Math.min(65535,Math.round(100*ei[4*e])),i[e]=Math.min(65535,Math.round(J[e]/1e-4)),(Z[e]>0||V[e]>0)&&a++;let n=new Int32Array(a),l=new Float32Array(a),s=new Float32Array(a),o=0;for(let e=0;e<_;e++)(Z[e]>0||V[e]>0)&&(n[o]=e,l[o]=Z[e],s[o]=V[e],o++);h.push({t:e,h:r,inf:i,idx:n,mw:l,ms:s,front:new Float32Array(0),stats:t})},ed=X/48,em=ed,ex=performance.now(),ep=null;try{for(;g.t<X;){let e=performance.now();for(;performance.now()-e<30&&g.t<X;){g.steps%10==0&&g.reduce();let e=Math.min(g.suggestDt(),X-g.t+.001,em-g.t+.001),t=ec(g.t);g.step(e,t),eo+=t.rain*e*1e3,(g.steps%4==0||g.t>=em-.001)&&(ep=eh(g.t-eu,g.t),eu=g.t),g.t>=em-.001&&(ep||(ep=eh(0,g.t)),ef(g.t,ep),em+=ed)}if(A({progress:Math.min(1,g.t/X),frames:h.length}),await new Promise(e=>setTimeout(e,0)),r!==s)return void g.dispose()}}catch(e){g.dispose(),r===s&&A({phase:"error",message:e.message});return}g.dispose();let eg=h.reduce((e,t)=>e+t.h.byteLength+t.inf.byteLength+t.idx.byteLength+t.mw.byteLength+t.ms.byteLength,0);console.warn(`soil-flood: ${F}\xd7${y} тор (${S.toFixed(0)} м), ${g.steps} алхам, ${h.length} агшин, ${Math.round(performance.now()-ex)} мс, агшнууд ${(eg/1e6).toFixed(0)} МБ`),d=0;for(let e=0;e<_;e++)V[e]>d&&(d=V[e]);d=Math.max(d,.001),f=0,j(),A({phase:"ready",progress:1,frames:h.length,frame:0,stats:h[0]?.stats??null}),L()}function j(){let e=u;if(!o||!e||!m||!h.length){if(x=null,h.length)for(let e of h)e.stats.frontMax=0;A({cutOn:!1,stats:h[f]?.stats??g.stats});return}let{W:t,H:r,x0:i,y1:a,cellMerc:n}=m,l=e.samples.length,s=new Int32Array(l).fill(-1),c=[],d=0;e.samples.forEach((e,l)=>{if(null==e.elev)return;let[o,u]=R([e.lon,e.lat]),c=Math.floor((o-i)/n),h=Math.floor((a-u)/n);c>=0&&h>=0&&c<t&&h<r&&(s[l]=h*t+c,d++)});for(let t=0;t<l;t++){let r=e.samples[t].T;if(!r){c.push(()=>w.TEX.loam.Ks);continue}let i=[],a=0;r.forEach((t,r)=>{t>.01&&i.push([a+t,S(e.keys[r])]),a+=t}),c.push(e=>{let t=100*e;for(let[e,r]of i)if(t<e)return r;return i.length?i[i.length-1][1]:w.TEX.loam.Ks})}x=s;let p=new Float32Array(l),v=0,b=null;for(let e of h){let t=e.t-v,r=0;for(let i=0;i<l;i++){let a=s[i];if(a<0)continue;let n=(e.inf[a]-(b?b[a]:0))*1e-4;if(n>0){let e=c[i](p[i]);p[i]=Math.min(2,p[i]+Math.min(n/.3,e*t/86400/.3))}p[i]>r&&(r=p[i])}e.front=Float32Array.from(p),e.stats.frontMax=r,b=e.inf,v=e.t}A({cutOn:d>0,stats:h[f]?.stats??null})}function C(){e.waterL.removeAll(),e.seepL.removeAll()}let P=(r,i,a,n,l)=>{let s=new e.Mesh({spatialReference:t.SR,vertexAttributes:{position:i,uv:a},components:[new e.MeshComponent({faces:n,material:new e.MeshMaterial({colorTexture:new e.MeshTexture({data:l}),alphaMode:"blend",doubleSided:!0})})]});r.add(new e.Graphic({geometry:s,symbol:{type:"mesh-3d",symbolLayers:[{type:"fill",material:{color:[255,255,255,1]}}]}}))},D=null,O=null;function L(){C();let r=h[f];if(!r||!m)return;let{W:i,H:a,dx:n,pc:l,valid:s}=m,{mw:c,ms:g}=((e,t)=>{D&&D.length===t?(D.fill(0),O.fill(0)):(D=new Float32Array(t),O=new Float32Array(t));for(let t=0;t<e.idx.length;t++)D[e.idx[t]]=e.mw[t],O[e.idx[t]]=e.ms[t];return{mw:D,ms:O}})(r,i*a);p??=function(){if(!m)return null;let{W:e,H:r}=m,i=Math.max(1,Math.ceil(Math.max(e,r)/320)),a=[];for(let t=0;t<e;t+=i)a.push(t);a.push(e);let n=[];for(let e=0;e<r;e+=i)n.push(e);n.push(r);let l=[],s=[];for(let i of n)for(let n of a){let[a,o]=T(m.x0+n*m.cellMerc,m.y1-i*m.cellMerc);l.push(a,o,t.zAt(a,o)+2.5),s.push(n/e,i/r)}let o=[],u=a.length;for(let e=0;e<n.length-1;e++)for(let t=0;t<u-1;t++){let r=e*u+t;o.push(r,r+1,r+u+1,r,r+u+1,r+u)}return{pos:new Float64Array(l),uv:new Float32Array(s),faces:new Uint32Array(o)}}();let v=document.createElement("canvas");v.width=i,v.height=a;let b=v.getContext("2d"),w=b.createImageData(i,a),y=w.data;for(let e=0;e<i*a;e++){let t=r.h[e]/100;if(t<.02||!s[e])continue;let[i,a,o]=function(e){let t=[[0,.62,.92,1],[.3,.25,.68,1],[1,.08,.4,.9],[2,.05,.18,.65],[4,.22,.05,.45]],r=0;for(;r<t.length-2&&e>t[r+1][0];)r++;let i=t[r],a=t[r+1],n=Math.max(0,Math.min(1,(e-i[0])/(a[0]-i[0])));return[i[1]+(a[1]-i[1])*n,i[2]+(a[2]-i[2])*n,i[3]+(a[3]-i[3])*n]}(t),u=1e3*c[e]/(t*n*n*l[e]);if(u>.5){let e=Math.min(.85,Math.log10(1+u)/2.5),t=(0,F.rampC)(F.RN3,Math.min(1,Math.log10(1+u)/3));i=i*(1-e)+t[0]/255*e,a=a*(1-e)+t[1]/255*e,o=o*(1-e)+t[2]/255*e}let h=4*e;y[h]=Math.round(255*i),y[h+1]=Math.round(255*a),y[h+2]=Math.round(255*o),y[h+3]=Math.round(255*(.62+.33*Math.min(1,t/1.5)))}b.putImageData(w,0,0),p&&P(e.waterL,p.pos,p.uv,p.faces,v);let M=u;if(!o||!M||!x||r.front.length!==M.samples.length)return;let A=M.samples.length,E=document.createElement("canvas");E.width=512,E.height=128;let S=E.getContext("2d"),R=S.createImageData(512,128),_=R.data,j=!1;for(let e=0;e<512;e++){let t=Math.min(A-1,Math.round(e/511*(A-1))),i=x[t],a=r.front[t];if(i<0||a<=0)continue;let n=g[i],l=n>0?Math.log10(1+n/.05)/Math.log10(1+d/.05):0,s=(0,F.rampC)(F.RN3,Math.min(1,l)),o=Math.min(127,Math.floor(a/2*128));for(let t=0;t<128;t++){let r=(t+.5)/128*2;if(r>=a&&t!==o)break;j=!0;let i=Math.exp(-r/Math.max(.05,.5*a)),n=(512*t+e)*4;t===o?(_[n]=40,_[n+1]=60,_[n+2]=90,_[n+3]=200):l>.02?(_[n]=s[0],_[n+1]=s[1],_[n+2]=s[2],_[n+3]=Math.round(255*(.35+.6*l*i))):(_[n]=110,_[n+1]=165,_[n+2]=230,_[n+3]=Math.round(102*(.5+.5*i)))}}if(!j)return;S.putImageData(R,0,0);let L=o.rem*Math.PI/180,z=1.2*Math.sin(L)/t.mLon,k=1.2*Math.cos(L)/t.mLat,B=t.exs(),H=[],q=[],N=[],I=-1;for(let e=0;e<A;e++){let r=M.samples[e];if(null==r.elev){I=-1;continue}let i=r.lon+z,a=r.lat+k,n=t.zAt(r.lon,r.lat),l=H.length/3;H.push(i,a,n,i,a,n-200*B);let s=e/(A-1);q.push(s,0,s,1),I>=0&&N.push(I,I+1,l+1,I,l+1,l),I=l}N.length&&P(e.seepL,new Float64Array(H),new Float32Array(q),new Uint32Array(N),E)}return{start(){_()},setCut(e,t){u=t;let r=!!e&&!!o&&o.a[0]===e.a[0]&&o.a[1]===e.a[1]&&o.b[0]===e.b[0]&&o.b[1]===e.b[1];o=e,r||j(),h.length&&L()},setPreset(e){let t=y.find(t=>t.id===e);t&&t!==c&&(c=t,A({preset:e}))},setTime(e){h.length&&(A({frame:f=Math.max(0,Math.min(h.length-1,e)),stats:h[f].stats}),L())},preload:E,latrinesFailed:()=>a,destroy(){s++,C(),h=[],l?.getExtension("WEBGL_lose_context")?.loseContext(),l=null}}}({Mesh:i[4],MeshComponent:i[5],MeshMaterial:i[6],MeshTexture:i[7],Graphic:i[3],waterL:n,seepL:s,geom:o.geom,onState:U}),G(o.legend()),k("ready"),(window.requestIdleCallback??(e=>window.setTimeout(e,1500)))(()=>void A.current?.preload().catch(()=>{}))):o.destroy()}).catch(e=>{t&&k({error:e.message})}),()=>{t=!1,A.current?.destroy(),A.current=null,l.current?.destroy(),l.current=null}},[]);let Z=W?.phase==="ready",V=W?.frames??0,Y=r.useRef(-1);r.useEffect(()=>{if(!Z){Y.current=-1;return}Y.current!==V&&(Y.current=V,$(0),X(!0))},[Z,V]),r.useEffect(()=>{Z&&A.current?.setTime(Q)},[Q,Z]),r.useEffect(()=>{if(!K||!Z)return;let e=window.setInterval(()=>{$(e=>e>=V-1?(X(!1),e):e+1)},220);return()=>window.clearInterval(e)},[K,Z,V]);let J="loading"===z,ee=W?.phase==="loading"||W?.phase==="running",et=W?.stats??null,er=W&&V?W.tEnd*(Q+1)/V:0;return(0,t.jsx)("div",{className:"flex h-full min-h-0 flex-col",children:(0,t.jsxs)(f.Columns,{layout:"flex",id:"flood-soil",right:340,className:"min-h-0 flex-1",children:[(0,t.jsx)("div",{className:"flex min-h-0 min-w-0 flex-1 flex-col gap-2",children:(0,t.jsxs)("div",{className:"soil-scene-view relative min-h-0 flex-1 overflow-hidden rounded-xs border border-line bg-paper-3",children:[(0,t.jsx)("div",{ref:e,className:"absolute inset-0"}),"ready"===z?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("span",{className:"pointer-events-none absolute bottom-2 left-2 rounded-xs bg-paper/80 px-2 py-1 text-[10.5px] text-ink-2 backdrop-blur-sm",children:[(0,t.jsx)("span",{ref:L,className:"num font-semibold text-ink empty:hidden after:font-normal after:text-ink-2 after:content-['_·_']"}),"Хөрсний босоо өсгөлт ×",p.SOIL_EXAGGERATION," · усны гүн бодит масштаб · Зүсэлтийн нүүрэнд бохирдлын шингээлт"]}),W&&"idle"!==W.phase?(0,t.jsx)(P,{st:W,t:Q,playing:K,tNow:er,onT:e=>{X(!1),$(e)},onPlay:()=>{!K&&Q>=V-1&&$(0),X(e=>!e)}}):null,B?(0,t.jsx)("span",{className:"absolute top-2 left-2 rounded-xs border border-(--ochre) bg-paper/85 px-2 py-1 text-[11px] text-ink backdrop-blur-sm",children:B}):null]}):(0,t.jsx)("div",{className:"absolute inset-0 flex items-center justify-center gap-2 px-6",children:J?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.Loader2,{size:16,className:"animate-spin text-ink-3"}),(0,t.jsx)("span",{className:"text-[12px] text-ink-2",children:"Хөрсний блок ачаалж байна"})]}):(0,t.jsx)("span",{className:"max-w-[420px] text-center text-[12px] text-ink-2",children:"object"==typeof z?z.error:""})})]})}),(0,t.jsxs)("div",{className:"soil-side flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0",children:[(0,t.jsxs)(d.Card,{title:"БОРООНЫ ХУВИЛБАР",children:[(0,t.jsx)("div",{className:"grid grid-cols-2 gap-1",children:y.map(e=>{let r=(W?.preset??y[0].id)===e.id;return(0,t.jsxs)("button",{type:"button","aria-pressed":r,onClick:()=>A.current?.setPreset(e.id),className:(0,h.cn)("rounded-xs border px-2 py-1.5 text-left transition-colors",r?"border-(--tone) bg-(--tone)/10":"border-line bg-paper-3 hover:bg-paper-hi"),children:[(0,t.jsx)("span",{className:(0,h.cn)("block text-[11.5px] font-medium",r?"text-ink":"text-ink-2"),children:e.name}),(0,t.jsx)("span",{className:"num block text-[10px] text-ink-3",children:e.note})]},e.id)})}),(0,t.jsx)("p",{className:"mt-2 text-[10.5px] text-ink-3",children:"Хуурай хөрс, Хортоны шингээлттэй · барилга саад болно · хугацаа бороо + 1 цаг"}),(0,t.jsx)("button",{type:"button",disabled:ee,onClick:()=>A.current?.start(),className:(0,h.cn)("mt-2 flex w-full items-center justify-center gap-1.5 rounded-xs border px-3 py-2 text-[12px] font-semibold transition-colors",ee?"cursor-wait border-line bg-paper-3 text-ink-3":"border-(--tone) bg-(--tone)/12 text-ink hover:bg-(--tone)/20"),children:ee?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.Loader2,{size:14,className:"animate-spin"}),W?.phase==="loading"?W.message:"Тооцоолж байна"," · ",(0,t.jsxs)("span",{className:"num",children:[Math.round((W?.progress??0)*100),"%"]})]}):W?.phase==="ready"||W?.phase==="error"?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(o.RotateCcw,{size:14})," Дахин эхлүүлэх"]}):(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(s.Play,{size:14})," Эхлүүлэх"]})})]}),(0,t.jsxs)(d.Card,{title:"ТООЦООНЫ ТАЛБАЙ",children:[W&&"idle"!==W.phase?"error"===W.phase?(0,t.jsx)("p",{className:"text-[11.5px] text-(--clay)",children:W.message}):(0,t.jsxs)("dl",{className:"grid grid-cols-2 gap-x-3 gap-y-2",children:[(0,t.jsx)(d.Field,{label:"Талбай",value:W.area?`Улаанбаатар \xb7 ${W.area.kmW.toFixed(1)} \xd7 ${W.area.kmH.toFixed(1)} км`:"—"}),(0,t.jsx)(d.Field,{label:"Тор",value:W.area?`${W.area.w} \xd7 ${W.area.h} \xb7 ${W.area.dx.toFixed(0)} м`:"—"}),(0,t.jsx)(d.Field,{label:"Нүхэн жорлон",value:W.area?W.area.latrines.toLocaleString():"—"}),(0,t.jsx)(d.Field,{label:"Ам бүл",value:W.area?W.area.people.toLocaleString():"—"})]}):(0,t.jsx)("div",{className:"hatch rounded-xs border border-dashed border-line-2 px-3 py-4 text-center text-[11.5px] text-ink-2",children:"Тооцоо эхлээгүй байна"}),W?.noLatrines&&"idle"!==W.phase?(0,t.jsx)("p",{className:"mt-2 text-[10.5px] text-(--ochre)",children:"Нүхэн жорлонгийн багц ирсэнгүй — зөвхөн ус тооцогдоно"}):null]}),et?(0,t.jsxs)(d.Card,{title:`ҮР ДҮН \xb7 ${_(er)}`,children:[(0,t.jsxs)("ul",{className:"divide-y divide-line",children:[(0,t.jsx)(C,{icon:c.Waves,label:"Усанд автсан талбай",value:`${et.wetHa.toFixed(1)} га`}),(0,t.jsx)(C,{icon:a.Droplets,label:"Хамгийн их гүн",value:`${et.hmax.toFixed(2)} м`}),(0,t.jsx)(C,{icon:u.Toilet,label:"Автсан нүхэн жорлон",value:et.flooded.toLocaleString()}),(0,t.jsx)(C,{icon:i.CloudRain,label:"Угаагдсан азот",value:`${j(et.washed)} кг`,tone:!0}),(0,t.jsx)(C,{label:"Усанд зөөгдөж буй",value:`${j(et.inWater)} кг`}),(0,t.jsx)(C,{label:"Хөрсөнд шингэсэн",value:`${j(et.inSoil)} кг`}),(0,t.jsx)(C,{label:"Шугам сүлжээнд",value:`${j(et.drained)} кг`}),(0,t.jsx)(C,{label:"Талбайгаас урсаж гарсан",value:`${j(et.left)} кг`}),(0,t.jsx)(C,{label:"Чийгийн фронт зүсэлт дээр",value:W?.cutOn?`${(100*et.frontMax).toFixed(0)} см хүртэл`:"—"})]}),(0,t.jsxs)("p",{className:"mt-2 text-[10.5px] text-ink-3",children:["Нүхний нөөц азот — ам бүл × 4.5 кг/жил × ",.5," жил; азот задрахгүй (дээд хязгаарын үнэлгээ)"]})]}):null,q?(0,t.jsx)(g.SectionCard,{section:q,legend:I,plumes:null,onPick:(e,t)=>l.current?.pickAt(e,t)}):null]})]})})}],15976)},5899,function(e){e.n(e.i(15976))},49713,e=>{"use strict";var t=e.i(43476),r=e.i(71645),i=e.i(75157);function a({cols:e}){return(0,t.jsxs)(t.Fragment,{children:[null!=e.sides.left?(0,t.jsx)(n,{cols:e,side:"left"}):null,null!=e.sides.right?(0,t.jsx)(n,{cols:e,side:"right"}):null]})}function n({cols:e,side:r}){return(0,t.jsx)("div",{...e.grip(r),role:"separator","aria-orientation":"vertical","aria-label":"Баганын өргөн",style:"left"===r?{left:"var(--col-l)"}:{right:"var(--col-r)"},className:(0,i.cn)("group absolute inset-y-0 z-10 hidden w-2.5 cursor-col-resize touch-none xl:block"),children:(0,t.jsx)("span",{"aria-hidden":!0,className:"absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover:bg-data"})})}e.s(["Columns",0,function({id:e,left:n,right:l,layout:s="grid",className:o,children:u}){let c,h,f,d,m,x,p,g=r.useMemo(()=>({left:n,right:l}),[n,l]),v=(c=r.useRef(null),h=r.useRef({...g}),f=r.useRef(new Set),d=r.useRef(null),m=r.useCallback(()=>{let e=c.current;if(!e)return;let t=e.clientWidth;for(let r of["left","right"]){let i=h.current[r];if(null==i)continue;let a=i;t>0&&(a=Math.min(Math.max(a,180),Math.max(180,t-("left"===r?h.current.right??0:h.current.left??0)-300))),h.current[r]=a,e.style.setProperty("left"===r?"--col-l":"--col-r",`${Math.round(a)}px`)}},[]),x=r.useCallback(t=>{if(c.current=t,t){for(let t of["left","right"]){if(null==g[t]){h.current[t]=void 0,f.current.delete(t);continue}if(!f.current.has(t)){f.current.add(t),h.current[t]=g[t];try{let r=localStorage.getItem(`cols.${e}`);if(r){let e=JSON.parse(r);"number"==typeof e[t]&&(h.current[t]=e[t])}}catch{}}}m()}},[e,g,m]),r.useEffect(()=>{let e=()=>m();return window.addEventListener("resize",e),()=>window.removeEventListener("resize",e)},[m]),p=r.useCallback(()=>{try{localStorage.setItem(`cols.${e}`,JSON.stringify(h.current))}catch{}},[e]),{mount:x,grip:r.useCallback(e=>({onPointerDown:t=>{t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId),d.current={side:e,px:t.clientX,w:h.current[e]??180}},onPointerMove:e=>{let t=d.current;if(!t)return;let r=e.clientX-t.px;h.current[t.side]=t.w+("left"===t.side?r:-r),m()},onPointerUp:e=>{d.current&&p(),d.current=null,e.currentTarget.hasPointerCapture(e.pointerId)&&e.currentTarget.releasePointerCapture(e.pointerId)},onPointerCancel:e=>{d.current=null,e.currentTarget.hasPointerCapture(e.pointerId)&&e.currentTarget.releasePointerCapture(e.pointerId)},onDoubleClick:()=>{h.current[e]=g[e],m(),p()}}),[m,p,g]),sides:g}),b=r.useRef(null);return r.useLayoutEffect(()=>(v.mount(b.current),()=>v.mount(null))),(0,t.jsxs)("div",{ref:b,className:(0,i.cn)("relative gap-2.5","flex"===s?"flex flex-col xl:flex-row":(0,i.cn)("grid",null==g.left&&null==g.right?"grid-cols-1":null!=g.left&&null!=g.right?"xl:grid-cols-[var(--col-l)_1fr_var(--col-r)]":null!=g.left?"xl:grid-cols-[var(--col-l)_1fr]":"xl:grid-cols-[1fr_var(--col-r)]"),o),children:[(0,t.jsx)(a,{cols:v}),u]})}])},95103,e=>{"use strict";let t="https://js.arcgis.com/4.33/",r=null;e.s(["esriModules",0,function(e){return(window.require?Promise.resolve(window.require):r??=new Promise((e,i)=>{let a=document.documentElement,n=()=>`${t}esri/themes/${"light"!==a.dataset.theme?"dark":"light"}/main.css`,l=document.createElement("link");l.rel="stylesheet",l.href=n(),document.head.appendChild(l),new MutationObserver(()=>{l.href!==n()&&(l.href=n());let e="light"!==a.dataset.theme?"dark":"light";document.querySelectorAll(".calcite-mode-light, .calcite-mode-dark").forEach(t=>{t.classList.remove("calcite-mode-light","calcite-mode-dark"),t.classList.add(`calcite-mode-${e}`)})}).observe(a,{attributes:!0,attributeFilter:["data-theme"]});let s=document.createElement("script");s.src=`${t}init.js`,s.async=!0,s.onload=()=>{window.require?e(window.require):i(Error("ArcGIS SDK ачаалагдсангүй"))},s.onerror=()=>{r=null,i(Error("ArcGIS SDK татагдсангүй — сүлжээгээ шалгана уу"))},document.head.appendChild(s)})).then(t=>new Promise(r=>{t(e,(...e)=>r(e))}))}])},82990,91765,e=>{"use strict";let t=[{code:0,name:"Тодорхойгүй",n:.035,f0:30,fc:6,s:40},{code:10,name:"Ой мод",n:.1,f0:60,fc:15,s:80},{code:20,name:"Бут сөөг",n:.07,f0:50,fc:12,s:60},{code:30,name:"Бэлчээр, зүлэг",n:.035,f0:40,fc:8,s:50},{code:40,name:"Тариалан",n:.035,f0:40,fc:8,s:60},{code:50,name:"Барилгажсан",n:.02,f0:4,fc:1,s:15},{code:60,name:"Ил хөрс",n:.025,f0:25,fc:4,s:30},{code:70,name:"Цас, мөс",n:.02,f0:0,fc:0,s:0},{code:80,name:"Усан гадарга",n:.03,f0:0,fc:0,s:0},{code:90,name:"Намаг",n:.06,f0:5,fc:1,s:10},{code:100,name:"Хаг, хөвд",n:.04,f0:30,fc:6,s:40}],r=`#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`,i=`#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D;
const float G = 9.81;
// Buildings: a cell whose footprint share is >= SOLID is a wall (raised by the building height); below that the
// cell is porous (Sanders et al. 2008 style): water occupies only the open share PHI of the cell and crosses a
// face only through its open width, so flow is squeezed between and diverted around buildings even where they
// are smaller than a cell.
const float SOLID = 0.8;
float phiOf(float frac){ return frac >= SOLID ? 1.0 : max(1.0 - frac, 0.2); }
// Cell velocity from the averaged face fluxes. The faces already obey Froude <= 1, but dividing a face flux
// by a thinner cell depth (wetting fronts, steps in the terrain) gave spurious 10+ m/s spikes: cap at sqrt(g h).
vec2 cellVel(vec2 qsum, float h){
  vec2 v = qsum * 0.5 / max(h, 0.1);
  float vm = sqrt(G * max(h, 0.05)), l = length(v);
  return l > vm ? v * (vm / l) : v;
}
`,a=i+`
uniform usampler2D uLC, uBld, uRiv;
uniform sampler2D uDem;
uniform int uF;
uniform ivec2 uFine;
uniform ivec2 uOff;            // window origin on the fine grid (simulation area)
uniform float uDemF;
uniform vec4 uLc[11];          // n, f0, fc, soil storage mm
uniform float uBldOn;          // 1 = buildings are obstacles
layout(location=0) out float oZ;
layout(location=1) out vec4 oP; // n, f0 mm/h, fc mm/h, building fraction (>= SOLID: wall, else porous)
layout(location=2) out vec4 oG;  // ground with channels burned (display), urban fraction, natural ground (3D terrain), soil storage mm
layout(location=3) out vec2 oW;  // open width of the east / south face (0 = wall), from the fine building raster
bool bldAt(ivec2 p){ return uBldOn > 0.5 && p.x >= 0 && p.y >= 0 && p.x < uFine.x && p.y < uFine.y && texelFetch(uBld, p, 0).r > 0u; }
float dem(ivec2 p){ ivec2 s = textureSize(uDem, 0); return texelFetch(uDem, clamp(p, ivec2(0), s - 1), 0).r; }
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float cnt = 0.0, ns = 0.0, a0 = 0.0, ac = 0.0, st = 0.0, nb = 0.0, hb = 0.0, burn = 0.0, nu = 0.0;
  // F <= 8 (8 is the coarse city grid of lib/soil-flood.ts; the view itself uses 1..3)
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    if (i >= uF || j >= uF) continue;
    ivec2 p = uOff + c * uF + ivec2(i, j);
    if (p.x >= uFine.x || p.y >= uFine.y) continue;
    uint lcv = texelFetch(uLC, p, 0).r;
    int k = min(int(lcv) / 10, 10);
    vec4 prm = uLc[k];
    uint b = texelFetch(uBld, p, 0).r;
    burn = max(burn, float(texelFetch(uRiv, p, 0).r) * 0.1);
    cnt += 1.0; ns += prm.x; a0 += prm.y; ac += prm.z; st += prm.w;
    if (b > 0u) { nb += 1.0; hb += float(b); }
    if (b > 0u || lcv == 50u) nu += 1.0;       // served by street drainage (built-up)
  }
  cnt = max(cnt, 1.0);
  // A face is open along a fine row/column only where the fine cells on both sides are free: buildings
  // standing on the boundary between two cells block it, even when they cover little of either cell.
  float oe = 0.0, os = 0.0;
  for (int k = 0; k < 8; k++) {
    if (k >= uF) continue;
    ivec2 e0 = uOff + c * uF + ivec2(uF - 1, k), s0 = uOff + c * uF + ivec2(k, uF - 1);
    if (!bldAt(e0) && !bldAt(e0 + ivec2(1, 0))) oe += 1.0;
    if (!bldAt(s0) && !bldAt(s0 + ivec2(0, 1))) os += 1.0;
  }
  oW = vec2(oe, os) / float(uF);       // 0 = the face is a wall along its whole length
  // bilinear ground elevation at cell centre (DEM cell centres sit at (i+0.5)*demF fine cells)
  vec2 d = (vec2(uOff) + (vec2(c) + 0.5) * float(uF)) / uDemF - 0.5;
  ivec2 i0 = ivec2(floor(d)); vec2 t = d - vec2(i0);
  float z = mix(mix(dem(i0), dem(i0 + ivec2(1, 0)), t.x), mix(dem(i0 + ivec2(0, 1)), dem(i0 + ivec2(1, 1)), t.x), t.y);
  float frac = nb / cnt * uBldOn;
  float n = ns / cnt, f0 = a0 / cnt, fc = ac / cnt;
  float zNat = z;
  if (burn > 0.0) { z -= burn; n = 0.035; }
  oG = vec4(z, nu / cnt, zNat, st / cnt);
  if (frac >= SOLID) { z += hb / max(nb, 1.0); f0 = 0.0; fc = 0.0; }
  else n += 0.10 * frac;               // porous cell: extra drag; infiltration applies to the open ground only
  oZ = z;
  oP = vec4(n, f0, fc, frac);
}`,n=i+`
uniform sampler2D uH, uQ, uZ, uP, uWf;
uniform float uDt, uDx, uManMul, uTheta;
uniform ivec2 uSize;
uniform vec2 uWallE;           // rows of the east edge where a river enters (inflow boundary: no outflow)
out vec2 oQ;
// Domain edge = normal-depth outflow (as HEC-RAS): q = h^(5/3) sqrt(S) / n with S the ground slope towards the
// edge measured over ~200 m inside the domain (robust to DEM noise). Where the ground rises towards the edge
// (e.g. a river entering from outside) S = 0 and the edge is a wall, so water can't run back upstream and out.
const int EDGE_K = 10;
float edgeOut(float h, float zEdge, float zInner, float n){
  float S = max(zInner - zEdge, 0.0) / (float(EDGE_K) * uDx);
  if (h <= 1e-4 || S <= 0.0) return 0.0;
  float q = pow(h, 5.0 / 3.0) * sqrt(S) / max(n, 0.01);
  return min(min(q, h * sqrt(G * h)), h * uDx / (4.0 * uDt));
}

// w = open width of the face, pA / pB = open share of the two cells
float face(float q, float qa, float qb, float hA, float hB, float zA, float zB, float nA, float nB, float w, float pA, float pB){
  float etaA = zA + hA, etaB = zB + hB;
  float hf = max(etaA, etaB) - max(zA, zB);
  if (hf <= 1e-3 || w < 1e-3) return 0.0;                   // dry, or a building wall: nothing crosses
  float qs = uTheta * q + 0.5 * (1.0 - uTheta) * (qa + qb);   // de Almeida theta-weighting (damps checkerboarding)
  float n = 0.5 * (nA + nB) * uManMul;
  float s = (etaB - etaA) / uDx;
  float qn = (qs - G * hf * uDt * s) / (1.0 + G * uDt * n * n * abs(q) / pow(hf, 7.0 / 3.0));
  float lim = hf * sqrt(G * hf);                             // Froude <= 1 (steep mountain slopes)
  qn = clamp(qn, -lim, lim);
  // positivity: a face may move <= 1/4 of the water held in the open part of the upwind cell
  qn = min(qn,  hA * uDx * pA / (4.0 * uDt * w));
  qn = max(qn, -hB * uDx * pB / (4.0 * uDt * w));
  return qn;
}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float h = texelFetch(uH, c, 0).r, z = texelFetch(uZ, c, 0).r, n = texelFetch(uP, c, 0).r;
  vec2 q = texelFetch(uQ, c, 0).xy;
  vec2 wf = texelFetch(uWf, c, 0).xy;
  float pc = phiOf(texelFetch(uP, c, 0).a);
  vec2 o;
  if (c.x < uSize.x - 1) {
    ivec2 e = c + ivec2(1, 0);
    // de Almeida theta-weighting averages this face with its two neighbouring faces (c-1|c and c+1|c+2)
    float qa = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
    float qb = texelFetch(uQ, e, 0).x;                       // next face downstream (between c+1 and c+2)
    vec4 pe = texelFetch(uP, e, 0);
    o.x = face(q.x, qa, qb, h, texelFetch(uH, e, 0).r, z, texelFetch(uZ, e, 0).r, n, pe.r, min(wf.x, pc), pc, phiOf(pe.a));
  } else o.x = (float(c.y) >= uWallE.x && float(c.y) <= uWallE.y) ? 0.0
             : edgeOut(h, z, texelFetch(uZ, c - ivec2(min(EDGE_K, uSize.x - 1), 0), 0).r, n * uManMul);
  if (c.y < uSize.y - 1) {
    ivec2 s = c + ivec2(0, 1);
    float qa = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
    float qb = texelFetch(uQ, s, 0).y;
    vec4 ps = texelFetch(uP, s, 0);
    o.y = face(q.y, qa, qb, h, texelFetch(uH, s, 0).r, z, texelFetch(uZ, s, 0).r, n, ps.r, min(wf.y, pc), pc, phiOf(ps.a));
  } else o.y = edgeOut(h, z, texelFetch(uZ, c - ivec2(0, min(EDGE_K, uSize.y - 1)), 0).r, n * uManMul);
  oQ = o;
}`,l=i+`
uniform sampler2D uH, uQ, uP, uM, uZ, uWf;
uniform float uDt, uDx, uRain, uT, uInfMul, uHortonK, uTr, uDrain, uManMul;   // uDrain: storm-drain capacity, m/s
uniform float uWet;            // rain fallen so far, mm (soil saturation)
uniform sampler2D uGr;
uniform vec4 uRainCircle;      // cx, cy, r (cells), enabled
uniform vec4 uInflow[8];       // centre cell x, y (any point inside it), Q m^3/s, half-width (cells)
uniform int uNInflow;
uniform ivec2 uSize;
layout(location=0) out float oH;
layout(location=1) out vec4 oM;  // max depth, max speed, arrival time (min, -1 = dry), max hazard
// Domain edge = normal-depth outflow (as HEC-RAS): q = h^(5/3) sqrt(S) / n with S the ground slope towards the
// edge measured over ~200 m inside the domain (robust to DEM noise). Where the ground rises towards the edge
// (e.g. a river entering from outside) S = 0 and the edge is a wall, so water can't run back upstream and out.
const int EDGE_K = 10;
float edgeOut(float h, float zEdge, float zInner, float n){
  float S = max(zInner - zEdge, 0.0) / (float(EDGE_K) * uDx);
  if (h <= 1e-4 || S <= 0.0) return 0.0;
  float q = pow(h, 5.0 / 3.0) * sqrt(S) / max(n, 0.01);
  return min(min(q, h * sqrt(G * h)), h * uDx / (4.0 * uDt));
}

void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float h0 = texelFetch(uH, c, 0).r;
  vec2 q = texelFetch(uQ, c, 0).xy;
  float z0 = texelFetch(uZ, c, 0).r;
  float nE = texelFetch(uP, c, 0).r * uManMul;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : -edgeOut(h0, z0, texelFetch(uZ, c + ivec2(min(EDGE_K, uSize.x - 1), 0), 0).r, nE);
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : -edgeOut(h0, z0, texelFetch(uZ, c + ivec2(0, min(EDGE_K, uSize.y - 1)), 0).r, nE);
  // porosity: open share of this cell, open width of each face (= narrower of the two cells)
  float pc = phiOf(texelFetch(uP, c, 0).a);
  vec2 wf = texelFetch(uWf, c, 0).xy;
  float we = c.x < uSize.x - 1 ? min(wf.x, pc) : pc;
  float ws = c.y < uSize.y - 1 ? min(wf.y, pc) : pc;
  // the neighbour's flux pass used min(its face width, its own share): reproduce it exactly (conservation)
  float ww = c.x > 0 ? min(texelFetch(uWf, c - ivec2(1, 0), 0).x, phiOf(texelFetch(uP, c - ivec2(1, 0), 0).a)) : pc;
  float wn = c.y > 0 ? min(texelFetch(uWf, c - ivec2(0, 1), 0).y, phiOf(texelFetch(uP, c - ivec2(0, 1), 0).a)) : pc;
  float h = h0 + uDt / (uDx * pc) * (ww * qw - we * q.x + wn * qn - ws * q.y);
  float mask = 1.0;
  if (uRainCircle.w > 0.5) {
    float d = distance(vec2(c) + 0.5, uRainCircle.xy);
    mask = 1.0 - smoothstep(0.85 * uRainCircle.z, uRainCircle.z, d);
  }
  // Rain. Roofs inside porous cells drain into the cell's open part (hence / pc). A solid building cell
  // passes its rain to its open 4-neighbours in equal shares (downpipes); if it has none it keeps it.
  bool solid = texelFetch(uP, c, 0).a >= SOLID;
  int nOpen = 0;
  for (int k = 0; k < 4; k++) { ivec2 nb = c + (k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1));
    if (all(greaterThanEqual(nb, ivec2(0))) && all(lessThan(nb, uSize)) && texelFetch(uP, nb, 0).a < SOLID) nOpen++; }
  float rainIn = (solid && nOpen > 0) ? 0.0 : mask;
  if (!solid) {
    for (int k = 0; k < 4; k++) {
      ivec2 nb = c + (k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1));
      if (any(lessThan(nb, ivec2(0))) || any(greaterThanEqual(nb, uSize)) || texelFetch(uP, nb, 0).a < SOLID) continue;
      int m = 0;                                     // open neighbours of that roof cell
      for (int j = 0; j < 4; j++) { ivec2 nn = nb + (j == 0 ? ivec2(1, 0) : j == 1 ? ivec2(-1, 0) : j == 2 ? ivec2(0, 1) : ivec2(0, -1));
        if (all(greaterThanEqual(nn, ivec2(0))) && all(lessThan(nn, uSize)) && texelFetch(uP, nn, 0).a < SOLID) m++; }
      float mk = uRainCircle.w > 0.5 ? 1.0 - smoothstep(0.85 * uRainCircle.z, uRainCircle.z, distance(vec2(nb) + 0.5, uRainCircle.xy)) : 1.0;
      rainIn += mk / float(max(m, 1));
    }
  }
  h += uRain * rainIn * uDt / pc;
  for (int i = 0; i < 8; i++) {
    if (i >= uNInflow) break;
    // integer cell arithmetic: the (2r+1)^2 box always has exactly that many cells, so Q is conserved
    ivec2 dd = abs(c - ivec2(floor(uInflow[i].xy)));
    int r = int(uInflow[i].w + 0.5);
    ivec2 lo = ivec2(floor(uInflow[i].xy)) - r, hi = ivec2(floor(uInflow[i].xy)) + r;
    // boxes clipped by the domain edge spread Q over the cells that exist
    float cnt = float((min(hi.x, uSize.x - 1) - max(lo.x, 0) + 1) * (min(hi.y, uSize.y - 1) - max(lo.y, 0) + 1));
    if (dd.x <= r && dd.y <= r) h += uInflow[i].z * uDt / (cnt * uDx * uDx * pc);
  }
  vec4 p = texelFetch(uP, c, 0);
  float f = uInfMul * (p.z + (p.y - p.z) * exp(-uHortonK * uTr)) / 3.6e6;  // Horton, mm/h -> m/s
  vec4 gr = texelFetch(uGr, c, 0);
  // soil saturation: what has soaked in is at most the rain fallen and at most Horton's cumulative capacity
  float cap = uInfMul * (p.z * uTr + (p.y - p.z) * (1.0 - exp(-uHortonK * uTr)) / max(uHortonK, 1e-9)) / 3600.0;
  float stor = gr.w * uInfMul;                                               // wet soil holds less
  if (stor > 0.0) f *= 1.0 - 0.9 * smoothstep(0.7, 1.0, min(uWet, cap) / stor);
  f += uDrain * gr.g;                                                        // storm drains in built-up cells
  h = max(h - f * uDt, 0.0);
  oH = h;
  float spd = 0.0;
  if (h > 0.05) spd = length(cellVel(vec2(qw + q.x, qn + q.y), h));
  vec4 m = texelFetch(uM, c, 0);
  m.x = max(m.x, h);
  if (h > 0.05) m.y = max(m.y, spd);
  if (m.z < 0.0 && h > 0.1) m.z = uT / 60.0;
  // DEFRA FD2320/FD2321 hazard rating HR = d (v + 0.5) + DF, debris factor DF (urban): 0 / 0.5 (d > 0.25 m) / 1 (d > 0.75 m)
  if (h > 0.05) m.w = max(m.w, h * (spd + 0.5) + (h > 0.75 ? 1.0 : h > 0.25 ? 0.5 : 0.0));
  oM = m;
}`,s=`
float speed(ivec2 c, float h){
  if (h <= 0.05) return 0.0;
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return length(cellVel(vec2(qw + q.x, qn + q.y), h));
}`,o=i+`
uniform sampler2D uH, uQ, uP; uniform ivec2 uSize; uniform int uB;
out vec4 o;`+s+`
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy) * uB;
  vec4 r = vec4(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    ivec2 p = c + ivec2(i, j);
    if (p.x >= uSize.x || p.y >= uSize.y) continue;
    float h = texelFetch(uH, p, 0).r;
    r.x = max(r.x, h); r.y += h * phiOf(texelFetch(uP, p, 0).a); r.z += h > 0.1 ? 1.0 : 0.0;
    if (h > 0.05) r.w = max(r.w, speed(p, h));
  }
  o = r;
}`,u=i+`
uniform sampler2D uS; uniform ivec2 uSize;
out vec4 o;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy) * 8;
  vec4 r = vec4(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    ivec2 p = c + ivec2(i, j);
    if (p.x >= uSize.x || p.y >= uSize.y) continue;
    vec4 s = texelFetch(uS, p, 0);
    r.x = max(r.x, s.x); r.y += s.y; r.z += s.z; r.w = max(r.w, s.w);
  }
  o = r;
}`,c=i+`
uniform sampler2D uH, uQ, uZ, uM, uGr, uP; uniform ivec2 uCell;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o2;
layout(location=2) out vec4 o3;`+s+`
void main(){
  ivec2 c = uCell;
  float h = texelFetch(uH, c, 0).r;
  float spd = speed(c, h);
  float z = texelFetch(uZ, c, 0).r;
  o = vec4(h, spd, z + h, z);
  o2 = texelFetch(uM, c, 0);
  vec4 pp = texelFetch(uP, c, 0);
  o3 = vec4(texelFetch(uGr, c, 0).r, pp.a, pp.r, pp.g);   // bare ground, building fraction, Manning n, f0
}`,h=i+`
uniform sampler2D uH, uQ; uniform ivec2 uSize; uniform int uS;
out vec4 o;`+s+`
vec2 velC(ivec2 c, float h){
  if (h <= 0.05) return vec2(0.0);
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return cellVel(vec2(qw + q.x, qn + q.y), h);
}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy) * uS;
  vec4 r = vec4(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    if (i >= uS || j >= uS) continue;
    ivec2 p = c + ivec2(i, j);
    if (p.x >= uSize.x || p.y >= uSize.y) continue;
    float h = texelFetch(uH, p, 0).r;
    if (h > r.x) { r.x = h; r.yz = velC(p, h); }
  }
  o = r;
}`,f=i+`
uniform sampler2D uH, uQ, uM, uSnap;
uniform ivec2 uSize, uSnapSize;
uniform int uSrc;            // 0 live, 1 snapshot, 2 max envelope
uniform int uSnapS;
uniform vec4 uWin;           // grid cells
uniform vec2 uOut;           // ow, oh
uniform float uCanvasH;
out vec4 o;`+s+`
vec2 vel(ivec2 c, float h){
  if (h <= 0.05) return vec2(0.0);
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return cellVel(vec2(qw + q.x, qn + q.y), h);
}
int q6(float u){ return clamp(int(round(sign(u) * sqrt(min(abs(u), 8.0) / 8.0) * 31.0)) + 32, 1, 63); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y);          // image row 0 = top = north
  vec2 a = uWin.xy + floor(px) * (uWin.zw - uWin.xy) / uOut;
  vec2 b = uWin.xy + (floor(px) + 1.0) * (uWin.zw - uWin.xy) / uOut;
  ivec2 c0 = ivec2(floor(a)), c1 = max(ivec2(ceil(b)) - 1, c0);
  ivec2 st = max((c1 - c0 + 1) / 4, ivec2(1));                          // at most ~4x4 samples per pixel
  float best = 0.0; ivec2 bc = clamp(c0, ivec2(0), uSize - 1); float arr = 4095.0;
  for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) {
    ivec2 c = c0 + ivec2(i, j) * st;
    if (c.x > c1.x || c.y > c1.y) continue;
    if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, uSize))) continue;   // grid-aligned blocks may overhang the domain
    float h;
    if (uSrc == 1) h = texelFetch(uSnap, clamp(c / uSnapS, ivec2(0), uSnapSize - 1), 0).r;
    else if (uSrc == 2) { vec4 m = texelFetch(uM, c, 0); h = m.x; if (m.z >= 0.0) arr = min(arr, m.z); }
    else h = texelFetch(uH, c, 0).r;
    if (h > best) { best = h; bc = c; }
  }
  int d = clamp(int(round(best * 100.0)), 0, 4095);
  int lo;
  if (uSrc == 2) lo = clamp(int(arr), 0, 4095);
  else {
    vec2 v = uSrc == 1 ? texelFetch(uSnap, clamp(bc / uSnapS, ivec2(0), uSnapSize - 1), 0).gb : vel(bc, best);
    lo = (q6(v.x) << 6) | q6(v.y);
  }
  o = vec4(float(d >> 4), float(((d & 15) << 4) | (lo >> 8)), float(lo & 255), 255.0) / 255.0;
}`;function d(e,t,r){let i=e.createShader(t);if(e.shaderSource(i,r),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(i);throw console.error(r.split("\n").map((e,t)=>`${t+1}: ${e}`).join("\n")),Error("Shader compile error: "+t)}return i}function m(e,t,i=r){let a=e.createProgram();if(e.attachShader(a,d(e,e.VERTEX_SHADER,i)),e.attachShader(a,d(e,e.FRAGMENT_SHADER,t)),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw Error("Link error: "+e.getProgramInfoLog(a));let n={},l=e.getProgramParameter(a,e.ACTIVE_UNIFORMS);for(let t=0;t<l;t++){let r=e.getActiveUniform(a,t);n[r.name.replace(/\[0\]$/,"")]=e.getUniformLocation(a,r.name)}return{p:a,u:n}}let x={R32F:["R32F","RED","FLOAT"],RG32F:["RG32F","RG","FLOAT"],RGBA32F:["RGBA32F","RGBA","FLOAT"],RGBA16F:["RGBA16F","RGBA","HALF_FLOAT"],RG16F:["RG16F","RG","HALF_FLOAT"],R8UI:["R8UI","RED_INTEGER","UNSIGNED_BYTE"]};function p(e,t,r,i,a=null){let[n,l,s]=x[i],o=e.createTexture();return e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texStorage2D(e.TEXTURE_2D,1,e[n],t,r),a&&e.texSubImage2D(e.TEXTURE_2D,0,0,0,t,r,e[l],e[s],a),{tex:o,w:t,h:r,fmt:i}}function g(e,t){let r=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,r),t.forEach((t,r)=>e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+r,e.TEXTURE_2D,t.tex,0));let i=e.checkFramebufferStatus(e.FRAMEBUFFER);if(i!==e.FRAMEBUFFER_COMPLETE)throw Error("Framebuffer incomplete: 0x"+i.toString(16));return r}let v=0;e.s(["FloodSolver",0,class{constructor(e,t,r){if(this.gl=e,!e.getExtension("EXT_color_buffer_float"))throw Error("EXT_color_buffer_float дэмжигдэхгүй байна");const i=t.meta;this.meta=i,this.F=r.factor;const s=r.window||[0,0,i.W,i.H];this.window=s,this.off=[s[0],s[1]],this.W=Math.ceil((s[2]-s[0])/this.F),this.H=Math.ceil((s[3]-s[1])/this.F),this.x0=i.x0+s[0]*i.res,this.y1=i.y1-s[1]*i.res,this.cellMerc=i.res*this.F,this.dx=this.cellMerc*i.groundScale,this.vao=e.createVertexArray(),this.progs={init:m(e,a),flux:m(e,n),depth:m(e,l),red0:m(e,o),red:m(e,u),probe:m(e,c),snap:m(e,h),encode:m(e,f)};const{W:d,H:x}=this;this.Z=p(e,d,x,"R32F"),this.P=p(e,d,x,"RGBA16F"),this.Gr=p(e,d,x,"RGBA32F"),this.Wf=p(e,d,x,"RG16F"),this.Hs=[p(e,d,x,"R32F"),p(e,d,x,"R32F")],this.Qs=[p(e,d,x,"RG32F"),p(e,d,x,"RG32F")],this.Ms=[p(e,d,x,"RGBA16F"),p(e,d,x,"RGBA16F")],this.fbInit=g(e,[this.Z,this.P,this.Gr,this.Wf]),this.fbQ=this.Qs.map(t=>g(e,[t])),this.fbHM=[g(e,[this.Hs[0],this.Ms[0]]),g(e,[this.Hs[1],this.Ms[1]])],this.fbHread=this.Hs.map(t=>g(e,[t])),this.fbMread=this.Ms.map(t=>g(e,[t])),this.red=[];let v=Math.ceil(d/8),b=Math.ceil(x/8);for(;;){const t=p(e,v,b,"RGBA32F");if(this.red.push({t,fb:g(e,[t])}),v*b<=256)break;v=Math.ceil(v/8),b=Math.ceil(b/8)}this.probeT=[p(e,1,1,"RGBA32F"),p(e,1,1,"RGBA32F"),p(e,1,1,"RGBA32F")],this.probeFb=g(e,this.probeT),this.snapS=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(d*x/16e5)))),this.snapW=Math.ceil(d/this.snapS),this.snapH=Math.ceil(x/this.snapS),this.maxSnaps=Math.max(12,Math.min(90,Math.floor(2e8/(this.snapW*this.snapH*8)))),this.snaps=[],this._uploadSources(t),this.buildGrid(r.buildings),this.reset()}_uploadSources(e){let t=this.gl,r=e.meta;this.src={lc:p(t,r.W,r.H,"R8UI",e.lc),bld:p(t,r.W,r.H,"R8UI",e.bld),riv:p(t,r.W,r.H,"R8UI",e.riv),dem:p(t,r.demW,r.demH,"R32F",e.dem)},this.fineBld=e.bld}_bind(e,t){let r=this.gl;r.useProgram(e.p);let i=0;for(let[a,n]of Object.entries(t))r.activeTexture(r.TEXTURE0+i),r.bindTexture(r.TEXTURE_2D,n.tex),r.uniform1i(e.u[a],i++)}_draw(e,t,r,i=1){let a=this.gl;a.bindFramebuffer(a.FRAMEBUFFER,e),a.drawBuffers(Array.from({length:i},(e,t)=>a.COLOR_ATTACHMENT0+t)),a.viewport(0,0,t,r),a.drawArrays(a.TRIANGLES,0,3)}_begin(){let e=this.gl;e.bindVertexArray(this.vao),e.disable(e.BLEND),e.disable(e.DEPTH_TEST),e.disable(e.STENCIL_TEST),e.disable(e.CULL_FACE),e.disable(e.SCISSOR_TEST),e.colorMask(!0,!0,!0,!0)}_end(){let e=this.gl;e.bindVertexArray(null),e.bindFramebuffer(e.FRAMEBUFFER,null)}buildGrid(e){let r=this.gl,i=this.progs.init,a=this.meta;this.buildingsOn=e,this._begin(),this._bind(i,{uLC:this.src.lc,uBld:this.src.bld,uRiv:this.src.riv,uDem:this.src.dem}),r.uniform1i(i.u.uF,this.F),r.uniform2i(i.u.uFine,a.W,a.H),r.uniform2i(i.u.uOff,this.off[0],this.off[1]),r.uniform1f(i.u.uDemF,a.demF),r.uniform1f(i.u.uBldOn,+!!e),r.uniform4fv(i.u.uLc,t.flatMap(e=>[e.n,e.f0,e.fc,e.s])),this._draw(this.fbInit,this.W,this.H,4),this._end(),this.gridVersion=++v}readGrid(){let e=this.gl,t=this.W,r=this.H,i=new Float32Array(t*r),a=new Float32Array(t*r),n=new Uint8Array(t*r),l=new Float32Array(256*t*4);for(let[s,o,u]of[[this.Gr,0,i],[this.Gr,2,a],[this.P,3,null]]){let i=g(e,[s]);e.readBuffer(e.COLOR_ATTACHMENT0);for(let i=0;i<r;i+=256){let a=Math.min(256,r-i);e.readPixels(0,i,t,a,e.RGBA,e.FLOAT,l);for(let e=0;e<t*a;e++)u?u[i*t+e]=l[4*e+o]:n[i*t+e]=+(l[4*e+o]>=.8)}e.deleteFramebuffer(i)}return e.bindFramebuffer(e.FRAMEBUFFER,null),{key:`g${this.gridVersion}`,W:t,H:r,ground:i,groundNat:a,bld:n,dx:this.dx,cellMerc:this.cellMerc,x0:this.x0,y1:this.y1,F:this.F,off:this.off,fineBld:this.fineBld,fineW:this.meta.W,fineH:this.meta.H}}encode(e,t,r,i,a=null){let n=this.gl,l=this.progs.encode,s=n.canvas;return this._begin(),this._bind(l,{uH:this.Hcur,uQ:this.Qcur,uM:this.Mcur,uSnap:a?a.t:this.Hcur}),n.uniform2i(l.u.uSize,this.W,this.H),n.uniform2i(l.u.uSnapSize,this.snapW,this.snapH),n.uniform1i(l.u.uSrc,e),n.uniform1i(l.u.uSnapS,this.snapS),n.uniform4fv(l.u.uWin,t),n.uniform2f(l.u.uOut,r,i),n.uniform1f(l.u.uCanvasH,s.height),n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,s.height-i,r,i),n.drawArrays(n.TRIANGLES,0,3),n.bindVertexArray(null),{canvas:{width:s.width,height:s.height},source:s,win:t,ow:r,oh:i}}reset(){let e=this.gl;this._begin();for(let t=0;t<2;t++)e.bindFramebuffer(e.FRAMEBUFFER,this.fbHM[t]),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]),e.clearBufferfv(e.COLOR,0,[0,0,0,0]),e.clearBufferfv(e.COLOR,1,[0,0,-1,0]),e.bindFramebuffer(e.FRAMEBUFFER,this.fbQ[t]),e.clearBufferfv(e.COLOR,0,[0,0,0,0]);for(let t of(this._end(),this.snaps))e.deleteTexture(t.t.tex);this.snaps=[],this.cur=0,this.t=0,this.steps=0,this.stats={hmax:0,vol:0,wet:0,vmax:0},this.rainVol=0,this.inflowVol=0,this.lastDt=0,this._dropAsync(),this.stepsAtStats=0}get Hcur(){return this.Hs[this.cur]}get Qcur(){return this.Qs[this.cur]}get Mcur(){return this.Ms[this.cur]}suggestDt(e=.7){let t=Math.sqrt(9.81*Math.max(1.25*this.stats.hmax,.05));return Math.min(e*this.dx/(t+Math.max(this.stats.vmax,t)),5)}step(e,t){let r=this.gl,i=this.cur,a=1-i;this._begin();let n=this.progs.flux;this._bind(n,{uH:this.Hs[i],uQ:this.Qs[i],uZ:this.Z,uP:this.P,uWf:this.Wf}),r.uniform1f(n.u.uDt,e),r.uniform1f(n.u.uDx,this.dx),r.uniform1f(n.u.uManMul,t.manning),r.uniform1f(n.u.uTheta,t.theta),r.uniform2fv(n.u.uWallE,t.wallE||[1,0]),r.uniform2i(n.u.uSize,this.W,this.H),this._draw(this.fbQ[a],this.W,this.H),n=this.progs.depth,this._bind(n,{uH:this.Hs[i],uQ:this.Qs[a],uP:this.P,uM:this.Ms[i],uGr:this.Gr,uZ:this.Z,uWf:this.Wf}),r.uniform1f(n.u.uDrain,(t.drain||0)/36e5),r.uniform1f(n.u.uManMul,t.manning),r.uniform1f(n.u.uDt,e),r.uniform1f(n.u.uDx,this.dx),r.uniform1f(n.u.uRain,t.rain),r.uniform1f(n.u.uT,this.t+e),r.uniform1f(n.u.uInfMul,t.infMul),r.uniform1f(n.u.uHortonK,t.hortonK),r.uniform1f(n.u.uTr,t.tr),r.uniform1f(n.u.uWet,t.wet||0),r.uniform4fv(n.u.uRainCircle,t.circle);let l=new Float32Array(32);for(let i of(t.inflows.slice(0,8).forEach((e,t)=>l.set(e,4*t)),r.uniform4fv(n.u.uInflow,l),r.uniform1i(n.u.uNInflow,Math.min(8,t.inflows.length)),r.uniform2i(n.u.uSize,this.W,this.H),this._draw(this.fbHM[a],this.W,this.H,2),this._end(),this.cur=a,this.t+=e,this.steps++,this.lastDt=e,this.rainVol+=t.rain*t.rainArea*e,t.inflows))this.inflowVol+=i[2]*e}reduce(){this._dropAsync(),this._reducePasses();let e=this.gl,t=this.red[this.red.length-1],r=new Float32Array(t.t.w*t.t.h*4);return e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.readBuffer(e.COLOR_ATTACHMENT0),e.readPixels(0,0,t.t.w,t.t.h,e.RGBA,e.FLOAT,r),this._end(),this._stats(r)}reduceStart(){if(this.reduceQ=this.reduceQ||[],this.reduceQ.length>=4)return!1;this._reducePasses();let e=this.gl,t=this.red[this.red.length-1],r=t.t.w*t.t.h*16;this.pbos=this.pbos||[];let i=new Set(this.reduceQ.map(e=>e.pbo)),a=this.pbos.find(e=>!i.has(e));return a||(a=e.createBuffer(),e.bindBuffer(e.PIXEL_PACK_BUFFER,a),e.bufferData(e.PIXEL_PACK_BUFFER,r,e.STREAM_READ),this.pbos.push(a)),e.bindBuffer(e.PIXEL_PACK_BUFFER,a),e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.readBuffer(e.COLOR_ATTACHMENT0),e.readPixels(0,0,t.t.w,t.t.h,e.RGBA,e.FLOAT,0),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),this._end(),this.reduceQ.push({sync:e.fenceSync(e.SYNC_GPU_COMMANDS_COMPLETE,0),n:r/4,pbo:a,steps:this.steps}),e.flush(),!0}get reducePending(){return!!(this.reduceQ&&this.reduceQ.length)}get reduceInFlight(){return this.reduceQ?this.reduceQ.length:0}reducePoll(){let e=this.gl,t=this.reduceQ,r=null;for(;t&&t.length&&e.getSyncParameter(t[0].sync,e.SYNC_STATUS)===e.SIGNALED;)r=t.shift(),e.deleteSync(r.sync);if(!r)return!1;let i=new Float32Array(r.n);return e.bindBuffer(e.PIXEL_PACK_BUFFER,r.pbo),e.getBufferSubData(e.PIXEL_PACK_BUFFER,0,i),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),this._stats(i),this.stepsAtStats=r.steps,!0}_dropAsync(){for(let e of this.reduceQ||[])this.gl.deleteSync(e.sync);this.reduceQ=[]}_reducePasses(){let e=this.gl;this._begin();let t=this.progs.red0;this._bind(t,{uH:this.Hcur,uQ:this.Qcur,uP:this.P}),e.uniform2i(t.u.uSize,this.W,this.H),e.uniform1i(t.u.uB,8),this._draw(this.red[0].fb,this.red[0].t.w,this.red[0].t.h);for(let r=1;r<this.red.length;r++){t=this.progs.red;let i=this.red[r-1].t;this._bind(t,{uS:i}),e.uniform2i(t.u.uSize,i.w,i.h),this._draw(this.red[r].fb,this.red[r].t.w,this.red[r].t.h)}}_stats(e){let t={hmax:0,vol:0,wet:0,vmax:0};for(let r=0;r<e.length;r+=4)t.hmax=Math.max(t.hmax,e[r]),t.vol+=e[r+1],t.wet+=e[r+2],t.vmax=Math.max(t.vmax,e[r+3]);return t.vol*=this.dx*this.dx,t.wetArea=t.wet*this.dx*this.dx,this.stats=t,this.stepsAtStats=this.steps,t}probe(e,t){let r=this.gl,i=this.progs.probe;this._begin(),this._bind(i,{uH:this.Hcur,uQ:this.Qcur,uZ:this.Z,uM:this.Mcur,uGr:this.Gr,uP:this.P}),r.uniform2i(i.u.uCell,e,t),this._draw(this.probeFb,1,1,3);let a=new Float32Array(4),n=new Float32Array(4),l=new Float32Array(4);return r.readBuffer(r.COLOR_ATTACHMENT0),r.readPixels(0,0,1,1,r.RGBA,r.FLOAT,a),r.readBuffer(r.COLOR_ATTACHMENT1),r.readPixels(0,0,1,1,r.RGBA,r.FLOAT,n),r.readBuffer(r.COLOR_ATTACHMENT2),r.readPixels(0,0,1,1,r.RGBA,r.FLOAT,l),r.readBuffer(r.COLOR_ATTACHMENT0),this._end(),{h:a[0],v:a[1],wse:a[2],z:l[0],building:l[1]>=.8,n:l[2],f0:l[3],hmax:n[0],vmax:n[1],arrival:n[2],hazard:n[3]}}snapshot(){if(this.snaps.length>=this.maxSnaps)return!1;let e=this.gl,t=this.progs.snap,r=p(e,this.snapW,this.snapH,"RGBA16F"),i=g(e,[r]);return this._begin(),this._bind(t,{uH:this.Hcur,uQ:this.Qcur}),e.uniform2i(t.u.uSize,this.W,this.H),e.uniform1i(t.u.uS,this.snapS),this._draw(i,this.snapW,this.snapH),this._end(),e.deleteFramebuffer(i),this.snaps.push({t:r,time:this.t}),!0}readLayer(e,t=0,r){let i=this.gl,a="max"===e?this.fbMread[this.cur]:this.fbHread[this.cur],n=new Float32Array(256*this.W*4);i.bindFramebuffer(i.FRAMEBUFFER,a),i.readBuffer(i.COLOR_ATTACHMENT0);for(let e=0;e<this.H;e+=256){let a=Math.min(256,this.H-e);i.readPixels(0,e,this.W,a,i.RGBA,i.FLOAT,n);let l=new Float32Array(this.W*a);for(let e=0;e<l.length;e++)l[e]=n[4*e+t];r(e,a,l)}i.bindFramebuffer(i.FRAMEBUFFER,null)}readTex(e,t=null){let r=this.gl,i=g(r,["h"===e?this.Hcur:"q"===e?this.Qcur:"p"===e?this.P:"gr"===e?this.Gr:"wf"===e?this.Wf:this.Z]);return t&&t.length===this.W*this.H*4||(t=new Float32Array(this.W*this.H*4)),r.bindFramebuffer(r.FRAMEBUFFER,i),r.readBuffer(r.COLOR_ATTACHMENT0),r.readPixels(0,0,this.W,this.H,r.RGBA,r.FLOAT,t),r.bindFramebuffer(r.FRAMEBUFFER,null),r.deleteFramebuffer(i),t}dispose(){let e=this.gl;[this.Z,this.P,this.Gr,this.Wf,...this.Hs,...this.Qs,...this.Ms,...this.probeT,...this.red.map(e=>e.t),...this.snaps.map(e=>e.t),...Object.values(this.src)].forEach(t=>e.deleteTexture(t.tex)),[this.fbInit,...this.fbQ,...this.fbHM,...this.fbHread,...this.fbMread,this.probeFb,...this.red.map(e=>e.fb)].forEach(t=>e.deleteFramebuffer(t)),Object.values(this.progs).forEach(t=>e.deleteProgram(t.p))}},"program",0,m,"texture",0,p],82990);var b=e.i(64515);async function w(e=()=>{}){e("meta.json…");let t=await (await fetch((0,b.asset)("/flood/data/meta.json"))).json(),r=async(t,r)=>{e(`${r} ачаалж байна…`);let i=await fetch((0,b.asset)("/flood/data/"+t));if(!i.ok)throw Error(t+" олдсонгүй ("+i.status+")");let a=new Uint8Array(await i.arrayBuffer());if(31===a[0]&&139===a[1]){let e=new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"));a=new Uint8Array(await new Response(e).arrayBuffer())}return a},i=await r("dem.f32","Өндрийн загвар (Copernicus GLO-30)"),a=new Float32Array(i.buffer,i.byteOffset,t.demW*t.demH),n=await r("lc.u8.gz","Газрын бүрхэвч (WorldCover)"),l=await r("bld.u8.gz","Барилга"),s=await r("riv.u8.gz","Гол горхи");return e("GPU бэлтгэж байна…"),{meta:t,dem:a,lc:n,bld:l,riv:s}}e.s(["createSolverGL",0,function(){let e="u">typeof OffscreenCanvas?new OffscreenCanvas(1024,1024):Object.assign(document.createElement("canvas"),{width:1024,height:1024}),t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!e.transferToImageBitmap,premultipliedAlpha:!1,powerPreference:"high-performance"});if(!t)throw Error("Энэ хөтөч WebGL2 дэмжихгүй байна. Chrome / Edge-ийн сүүлийн хувилбарыг ашиглана уу.");return t},"loadFloodData",0,w],91765)}]);