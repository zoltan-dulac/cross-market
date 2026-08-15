const MARKET_INFO = {
  kijiji: {
    name: 'Kijiji',
    postUrl: 'https://www.kijiji.ca/',
    note: 'Open Kijiji and choose Post Ad. With the userscript installed, its CrossMarket panel can fill recognized visible text fields.'
  },
  facebook: {
    name: 'Facebook Marketplace',
    postUrl: 'https://www.facebook.com/marketplace/create/item',
    note: 'Opens Facebook Marketplace’s item listing page. The companion only acts when you press its Fill button.'
  },
  karrot: {
    name: 'Karrot',
    postUrl: 'https://ca.karrotmarket.com/?in=toronto-11052',
    note: 'Karrot supports desktop listings. If Kijiji or Facebook is already live, Karrot can also import that listing.'
  },
  craigslist: {
    name: 'Craigslist',
    postUrl: 'https://toronto.craigslist.org/',
    note: 'Craigslist is copy-only in the companion. Open Toronto Craigslist and choose “post”.'
  }
};
const STATUS_LABEL = { 'not-posted':'Not posted', draft:'Draft', live:'Live', sold:'Sold', removed:'Removed' };
let listings = [], current = null, activeListingId = '';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(url, options={}) {
  const r = await fetch(url, { headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
function toast(msg) { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.classList.remove('show'),1800); }
async function copy(text, label='Copied') { await navigator.clipboard.writeText(String(text ?? '')); toast(label); }
function marketValue(key, field) { return current.markets?.[key]?.[field] || current[field] || ''; }

async function refresh() {
  const [db, companion] = await Promise.all([api('/api/listings'), api('/api/companion')]);
  listings = db;
  activeListingId = companion.activeListingId || '';
  renderRows();
  renderActiveSummary();
  updateActivateButton();
}
function renderActiveSummary() {
  const active = listings.find(x => x.id === activeListingId);
  $('#activeSummary').innerHTML = active ? `Greasemonkey default: <strong>${esc(active.title)}</strong>` : 'No default Greasemonkey listing selected yet.';
}
function renderRows() {
  const q=$('#filter').value.trim().toLowerCase();
  const filtered=listings.filter(x=>[x.title,x.category,x.location].join(' ').toLowerCase().includes(q));
  $('#listingRows').innerHTML = filtered.length ? filtered.map(x => `
    <tr${x.id === activeListingId ? ' class="active-row"' : ''}>
      <td><strong>${x.id === activeListingId ? '<span aria-label="Greasemonkey default">★</span> ' : ''}${esc(x.title)}</strong><br><small>${esc(x.category || '')}</small></td>
      <td>${esc(x.price ? '$'+x.price : '')}</td>
      ${['kijiji','facebook','karrot','craigslist'].map(k=>`<td><span class="status-dot">${statusIcon(x.markets[k].status)} ${esc(STATUS_LABEL[x.markets[k].status])}</span></td>`).join('')}
      <td><div class="row-actions"><button type="button" data-activate="${x.id}">${x.id === activeListingId ? 'Using in Greasemonkey' : 'Use in Greasemonkey'}</button><button type="button" data-edit="${x.id}">Edit</button></div></td>
    </tr>`).join('') : '<tr><td colspan="7">No listings yet.</td></tr>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editListing(b.dataset.edit));
  document.querySelectorAll('[data-activate]').forEach(b=>b.onclick=()=>setActiveListing(b.dataset.activate));
}
function statusIcon(s) { return ({live:'●',sold:'✓',draft:'◐',removed:'×','not-posted':'○'})[s] || '○'; }

function blankListing() {
  return { id:'', title:'', price:'', condition:'', category:'', location:'', description:'', tags:[], photos:[], markets:Object.fromEntries(Object.keys(MARKET_INFO).map(k=>[k,{status:'not-posted',url:'',title:'',description:'',price:'',category:'',location:''}])) };
}
function populateEditor() {
  $('#listingId').value=current.id || '';
  for (const f of ['title','price','condition','category','location','description']) $('#'+f).value=current[f] || '';
  $('#tags').value=(current.tags||[]).join(', ');
  $('#deleteBtn').hidden=!current.id;
  updateActivateButton();
  renderPhotos(); renderMarkets();
  $('#editor').classList.remove('hidden'); $('#title').focus();
}
function newListing() { current=blankListing(); populateEditor(); }
async function editListing(id) { current=await api('/api/listings/'+id); populateEditor(); }

function collectMaster() {
  return {
    title:$('#title').value, price:$('#price').value, condition:$('#condition').value,
    category:$('#category').value, location:$('#location').value, description:$('#description').value,
    tags:$('#tags').value.split(',').map(s=>s.trim()).filter(Boolean), markets: current.markets
  };
}
async function saveMaster(ev) {
  ev?.preventDefault();
  const body=collectMaster();
  current = current.id ? await api('/api/listings/'+current.id,{method:'PUT',body:JSON.stringify(body)}) : await api('/api/listings',{method:'POST',body:JSON.stringify(body)});
  $('#listingId').value=current.id; $('#deleteBtn').hidden=false; $('#saveMessage').textContent='Saved.';
  setTimeout(()=>$('#saveMessage').textContent='',1500); await refresh(); renderMarkets(); renderPhotos();
  return current;
}
async function setActiveListing(id) {
  if (!id) {
    if (!current?.id) await saveMaster();
    id = current.id;
  }
  await api('/api/companion/active', { method:'PUT', body:JSON.stringify({ id }) });
  activeListingId = id;
  await refresh();
  toast('Greasemonkey default listing selected');
}
function updateActivateButton() {
  const b=$('#activateBtn');
  if (!b) return;
  if (!current?.id) { b.textContent='Save & use in Greasemonkey'; return; }
  b.textContent=current.id === activeListingId ? 'Using in Greasemonkey' : 'Use in Greasemonkey';
}

function renderPhotos() {
  $('#photos').innerHTML=(current.photos||[]).map(p=>`<div class="photo"><img src="${esc(p.url)}" alt=""><small>${esc(p.name)}</small><button type="button" data-photo-delete="${esc(p.file)}">Remove</button></div>`).join('');
  document.querySelectorAll('[data-photo-delete]').forEach(b=>b.onclick=()=>removePhoto(b.dataset.photoDelete));
}
async function addPhotos(files) {
  if (!current.id) await saveMaster();
  for (const file of files) {
    const dataUrl=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
    await api(`/api/listings/${current.id}/photos`,{method:'POST',body:JSON.stringify({name:file.name,dataUrl})});
  }
  current=await api('/api/listings/'+current.id); renderPhotos(); await refresh();
}
async function removePhoto(file) { await api(`/api/listings/${current.id}/photos/${encodeURIComponent(file)}`,{method:'DELETE'}); current=await api('/api/listings/'+current.id); renderPhotos(); }

function renderMarkets() {
  const host=$('#markets'); host.innerHTML='';
  for (const [key,info] of Object.entries(MARKET_INFO)) {
    const node=$('#marketTemplate').content.cloneNode(true); const card=node.querySelector('.market-card'); card.dataset.market=key;
    card.querySelector('h4').textContent=info.name; const m=current.markets[key]; card.querySelector('.badge').textContent=STATUS_LABEL[m.status];
    const actions=card.querySelector('.actions');
    actions.innerHTML=`<a class="button" href="${info.postUrl}" target="_blank" rel="noopener">Open ${esc(info.name)}</a>
      <button type="button" data-copy="title">Copy title</button><button type="button" data-copy="price">Copy price</button><button type="button" data-copy="description">Copy description</button>`;
    if (key==='karrot') actions.insertAdjacentHTML('beforeend','<button type="button" data-karrot-import>Copy source URL for Karrot import</button>');
    const note=document.createElement('p'); note.className='help'; note.textContent=info.note; actions.after(note);
    for (const f of ['status','url','title','price','category','location','description']) card.querySelector('.m-'+f).value=m[f] || '';
    card.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(marketValue(key,b.dataset.copy),`${info.name}: ${b.dataset.copy} copied`));
    card.querySelector('.save-market').onclick=()=>saveMarket(key,card);
    const ki=card.querySelector('[data-karrot-import]'); if (ki) ki.onclick=()=>copyKarrotSource();
    host.appendChild(node);
  }
}
async function saveMarket(key, card) {
  const m=current.markets[key];
  for (const f of ['status','url','title','price','category','location','description']) m[f]=card.querySelector('.m-'+f).value.trim();
  current=await api('/api/listings/'+current.id,{method:'PUT',body:JSON.stringify(collectMaster())}); await refresh(); renderMarkets(); toast(`${MARKET_INFO[key].name} details saved`);
}
function copyKarrotSource() {
  const k=current.markets.kijiji.url, f=current.markets.facebook.url;
  const source=k || f;
  if (!source) return toast('Add a live Kijiji or Facebook listing URL first');
  copy(source,'Source listing URL copied for Karrot import');
}

$('#newBtn').onclick=newListing;
$('#filter').oninput=renderRows;
$('#listingForm').onsubmit=saveMaster;
$('#activateBtn').onclick=()=>setActiveListing(current?.id).catch(err=>toast(err.message));
$('#photoInput').onchange=e=>{ addPhotos([...e.target.files]).catch(err=>toast(err.message)); e.target.value=''; };
$('#deleteBtn').onclick=async()=>{
  if (!current.id || !confirm(`Delete “${current.title}” from this local assistant? This does not delete marketplace posts.`)) return;
  await api('/api/listings/'+current.id,{method:'DELETE'}); current=null; $('#editor').classList.add('hidden'); await refresh();
};

refresh().catch(err=>toast(err.message));
