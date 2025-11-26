const Toast={show:(m)=>{const x=document.getElementById("toast");x.innerText=m;x.className="show";setTimeout(()=>{x.className=x.className.replace("show","")},3000)}};

const DB = {
    data: { sites: [], types: [], groups: [], equips: [], checks: [], os: [] },
    init: () => { const s=localStorage.getItem('sys_v105'); if(s) DB.data=JSON.parse(s); else DB.seed(); },
    save: () => { localStorage.setItem('sys_v105', JSON.stringify(DB.data)); App.updateDash(); },
    seed: () => { DB.data.sites=[{id:1,name:'Matriz SP'}]; DB.data.types=[{id:10,name:'Câmera IP',isVideo:true}]; DB.save(); },
    reset: () => { if(confirm('RESETAR TUDO?')){ localStorage.removeItem('sys_v105'); location.reload(); } },
    export: () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(DB.data)],{type:'application/json'})); a.download='backup.json'; a.click(); },
    import: (inp) => { const fr=new FileReader(); fr.onload=(e)=>{ if(confirm("Restaurar?")){ DB.data=JSON.parse(e.target.result); DB.save(); location.reload(); }}; fr.readAsText(inp.files[0]); }
};

const Auth={login:()=>{if(document.getElementById('login-user').value==='admin'){document.getElementById('login-screen').style.display='none';App.init();Nav.go('hero')}}};

// --- O.S. SYSTEM (ATUALIZADO: Excluir + Imprimir) ---
const OS = {
    init: () => {
        const sel = document.getElementById('os-filter-site');
        // Mantém a lista de sites atualizada
        sel.innerHTML = '<option value="">Todos os Locais</option>' + DB.data.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
        OS.render();
    },
    render: () => {
        const siteFilter = document.getElementById('os-filter-site').value;
        const openContainer = document.getElementById('os-list-open');
        const doneContainer = document.getElementById('os-list-done');
        
        let list = DB.data.os.sort((a,b)=>b.id-a.id); // Mais recente primeiro
        if(siteFilter) list = list.filter(o => o.siteId == siteFilter);

        openContainer.innerHTML = '';
        doneContainer.innerHTML = '';

        if(list.length === 0) {
            openContainer.innerHTML = '<p style="padding:20px; color:#888; text-align:center">Nenhuma O.S.</p>';
        }

        list.forEach(os => {
            const equip = DB.data.equips.find(e => e.id === os.equipId);
            const group = equip ? DB.data.groups.find(g => g.id === equip.groupId) : {name:'?'};
            const site = equip ? DB.data.sites.find(s => s.id === equip.siteId) : {name:'?'};
            const itemName = equip ? equip.name : 'Item excluído';
            
            // Botões de ação
            const btnFinish = os.status === 'aberto' 
                ? `<button class="btn btn-sm btn-success" title="Concluir" onclick="OS.finish(${os.id})"><i class="fas fa-check"></i></button>` 
                : `<span style="font-size:11px; color:#10b981; margin-right:5px"><i class="fas fa-check-double"></i> Fechado em ${os.dateClose}</span>`;

            const html = `
            <div class="os-card p-${os.priority}">
                <div class="os-header">
                    <span>#${os.id} • ${os.dateOpen}</span>
                    <span>${site.name}</span>
                </div>
                <div class="os-title">${group.name} - ${itemName}</div>
                <div class="os-desc">${os.desc}</div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid #eee; padding-top:10px">
                    <div>
                        <button class="btn btn-sm btn-dark" title="Imprimir Ticket" onclick="OS.printTicket(${os.id})"><i class="fas fa-print"></i></button>
                        <button class="btn btn-sm btn-danger" title="Excluir O.S." onclick="OS.del(${os.id})"><i class="fas fa-trash"></i></button>
                    </div>
                    <div>
                        ${btnFinish}
                    </div>
                </div>
            </div>`;

            if(os.status === 'aberto') openContainer.innerHTML += html;
            else doneContainer.innerHTML += html;
        });
    },
    prompt: (equipId) => {
        document.getElementById('os-input-equip-id').value = equipId;
        document.getElementById('os-input-desc').value = '';
        document.getElementById('modal-os').style.display = 'flex';
    },
    closeModal: () => {
        document.getElementById('modal-os').style.display = 'none';
    },
    create: () => {
        const equipId = parseInt(document.getElementById('os-input-equip-id').value);
        const desc = document.getElementById('os-input-desc').value;
        const prio = document.getElementById('os-input-prio').value;
        
        if(!desc) return alert("Digite a descrição.");
        const equip = DB.data.equips.find(e=>e.id===equipId);
        
        DB.data.os.push({
            id: Date.now(),
            equipId: equipId,
            siteId: equip ? equip.siteId : 0,
            status: 'aberto',
            priority: prio,
            desc: desc,
            dateOpen: new Date().toLocaleDateString('pt-BR'),
            dateClose: null
        });
        DB.save();
        OS.closeModal();
        Toast.show("O.S. Criada!");
    },
    finish: (id) => {
        if(confirm("Confirmar conclusão da manutenção?")) {
            const os = DB.data.os.find(o => o.id === id);
            if(os) {
                os.status = 'concluido';
                os.dateClose = new Date().toLocaleDateString('pt-BR');
                DB.save();
                OS.render();
            }
        }
    },
    del: (id) => {
        if(confirm("ATENÇÃO: Deseja apagar esta O.S. permanentemente?")) {
            DB.data.os = DB.data.os.filter(o => o.id !== id);
            DB.save();
            OS.render();
            Toast.show("O.S. Excluída");
        }
    },
    printTicket: (id) => {
        const os = DB.data.os.find(o => o.id === id);
        if(!os) return;
        
        const equip = DB.data.equips.find(e => e.id === os.equipId);
        const group = equip ? DB.data.groups.find(g => g.id === equip.groupId) : {name:'?'};
        const site = equip ? DB.data.sites.find(s => s.id === equip.siteId) : {name:'?'};

        // Cria uma janela pop-up em branco
        const win = window.open('', '', 'width=400,height=600');
        
        // Escreve o HTML do ticket dentro dessa janela
        win.document.write(`
            <html>
            <head>
                <title>O.S. #${os.id}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; }
                    .box { border: 2px solid #000; padding: 15px; }
                    h2 { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; }
                    .label { font-weight: bold; margin-top: 10px; display:block; }
                    .val { margin-bottom: 10px; display:block; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #000; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h2>ORDEM DE SERVIÇO</h2>
                    <span class="label">ID / DATA:</span>
                    <span class="val">#${os.id} - ${os.dateOpen}</span>
                    
                    <span class="label">LOCAL:</span>
                    <span class="val">${site.name}</span>
                    
                    <span class="label">EQUIPAMENTO:</span>
                    <span class="val">${group.name} > ${equip.name}</span>
                    
                    <span class="label">PRIORIDADE:</span>
                    <span class="val" style="text-transform:uppercase">${os.priority}</span>
                    
                    <div style="border:1px dashed #000; margin: 15px 0;"></div>
                    
                    <span class="label">DEFEITO RELATADO:</span>
                    <span class="val">${os.desc}</span>
                    
                    <div style="height:50px"></div>
                    
                    <div class="footer">
                        __________________________<br>
                        Assinatura Técnico
                    </div>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        win.document.close();
    }
};

// --- CHECKLIST LOGIC ---
const Logic = {
    saveCheck: (id, st, type) => {
        const dateId = type === 'cctv' ? 'cctv-date' : 'eq-date';
        const loadFn = type === 'cctv' ? ChecklistCCTV.load : ChecklistEq.load;
        const date = document.getElementById(dateId).value;
        
        DB.data.checks = DB.data.checks.filter(c => !(c.date === date && c.equipId === id));
        DB.data.checks.push({ date, equipId: id, status: st });
        DB.save();
        loadFn();
        Toast.show('Salvo');

        if(st === 'Erro') {
            const existingOS = DB.data.os.find(o => o.equipId === id && o.status === 'aberto');
            if(!existingOS) {
                OS.prompt(id);
            } else {
                Toast.show("Já existe O.S. aberta para este item.");
            }
        }
    }
};

const ChecklistCCTV = {
    init: () => { document.getElementById('cctv-date').valueAsDate=new Date(); document.getElementById('cctv-site').innerHTML='<option value="">...</option>'+DB.data.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join('') },
    clear: () => document.getElementById('cctv-container').innerHTML='',
    onSiteChange: () => {
        const sid=parseInt(document.getElementById('cctv-site').value);
        const groups=DB.data.groups.filter(g=>g.siteId===sid);
        const grpSel=document.getElementById('cctv-group');
        const vidTypes = DB.data.types.filter(t=>t.isVideo).map(t=>t.id);
        const vidGroups = groups.filter(g=>vidTypes.includes(g.typeId));
        grpSel.innerHTML='<option value="">Selecione...</option>'+vidGroups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
        grpSel.disabled=false;
        ChecklistCCTV.clear();
    },
    load: () => {
        const gid=parseInt(document.getElementById('cctv-group').value);
        const date=document.getElementById('cctv-date').value;
        if(!gid) return alert("Selecione grupo");
        const items=DB.data.equips.filter(e=>e.groupId===gid);
        const container=document.getElementById('cctv-container');
        container.className="cctv-grid";
        if(items.length===0) return container.innerHTML='Vazio';
        
        container.innerHTML=items.map(i=>{
            const check=DB.data.checks.find(c=>c.date===date && c.equipId===i.id);
            const st=check?check.status:'Pendente';
            const img = i.image ? `<img src="${i.image}" class="cctv-feed" onclick="document.getElementById('modal-img-tag').src='${i.image}';document.getElementById('modal-photo').style.display='flex'">` : `<div class="cctv-noise">NO SIGNAL</div>`;
            return `
            <div class="cctv-card st-${st.toLowerCase()}">
                ${st==='OK'?'<div style="position:absolute;top:10px;right:10px;color:#10b981;font-weight:bold;text-shadow:0 0 5px #000">● REC</div>':''}
                ${img}
                <div class="cctv-hud">
                    <div class="cctv-name">${i.name}</div>
                    <select class="cctv-select" onchange="Logic.saveCheck(${i.id}, this.value, 'cctv')">
                        <option ${st=='Pendente'?'selected':''}>Pendente</option>
                        <option ${st=='OK'?'selected':''}>OK</option>
                        <option ${st=='Erro'?'selected':''}>Erro</option>
                    </select>
                </div>
            </div>`;
        }).join('');
    }
};

const ChecklistEq = {
    init: () => { document.getElementById('eq-date').valueAsDate=new Date(); document.getElementById('eq-site').innerHTML='<option value="">...</option>'+DB.data.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join('') },
    clear: () => document.getElementById('eq-container').innerHTML='',
    onSiteChange: () => {
        const sid=parseInt(document.getElementById('eq-site').value);
        const groups=DB.data.groups.filter(g=>g.siteId===sid);
        const grpSel=document.getElementById('eq-group');
        const vidTypes = DB.data.types.filter(t=>t.isVideo).map(t=>t.id);
        const nonVidGroups = groups.filter(g=>!vidTypes.includes(g.typeId));
        grpSel.innerHTML='<option value="">Selecione...</option>'+nonVidGroups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
        grpSel.disabled=false;
        ChecklistEq.clear();
    },
    load: () => {
        const gid=parseInt(document.getElementById('eq-group').value);
        const date=document.getElementById('eq-date').value;
        if(!gid) return alert("Selecione grupo");
        const items=DB.data.equips.filter(e=>e.groupId===gid);
        const container=document.getElementById('eq-container');
        container.className="list-group";
        if(items.length===0) return container.innerHTML='Vazio';
        
        container.innerHTML=items.map(i=>{
            const check=DB.data.checks.find(c=>c.date===date && c.equipId===i.id);
            const st=check?check.status:'Pendente';
            let bg = '';
            if(st==='OK') bg='background:rgba(16,185,129,0.1); border-left:4px solid #10b981';
            if(st==='Erro') bg='background:rgba(239,68,68,0.1); border-left:4px solid #ef4444';
            
            return `
            <div class="list-item" style="${bg}">
                <b>${i.name}</b>
                <select class="cctv-select" style="width:100px; height:30px" onchange="Logic.saveCheck(${i.id}, this.value, 'eq')">
                    <option ${st=='Pendente'?'selected':''}>Pendente</option>
                    <option ${st=='OK'?'selected':''}>OK</option>
                    <option ${st=='Erro'?'selected':''}>Erro</option>
                </select>
            </div>`;
        }).join('');
    }
};

const AdmSites={render:()=>{document.getElementById('site-list').innerHTML=DB.data.sites.map(s=>`<li class="list-item"><b>${s.name}</b><button class="btn btn-sm btn-danger" onclick="AdmSites.del(${s.id})"><i class="fas fa-trash"></i></button></li>`).join('')},add:()=>{const n=document.getElementById('site-name').value;if(n){DB.data.sites.push({id:Date.now(),name:n});DB.save();document.getElementById('site-name').value='';AdmSites.render();Toast.show('Site add')}},del:(id)=>{if(confirm('Del?')){DB.data.sites=DB.data.sites.filter(x=>x.id!==id);DB.save();AdmSites.render()}}};
const AdmTypes={render:()=>{document.getElementById('type-list').innerHTML=DB.data.types.map(t=>`<li class="list-item"><span>${t.isVideo?'📷':''} ${t.name}</span><button class="btn btn-sm btn-danger" onclick="AdmTypes.del(${t.id})"><i class="fas fa-trash"></i></button></li>`).join('')},add:()=>{const n=document.getElementById('type-name').value;const c=document.getElementById('type-cat').value;if(n){DB.data.types.push({id:Date.now(),name:n,isVideo:c==='video'});DB.save();document.getElementById('type-name').value='';AdmTypes.render();Toast.show('Tipo add')}},del:(id)=>{if(confirm('Del?')){DB.data.types=DB.data.types.filter(x=>x.id!==id);DB.save();AdmTypes.render()}}};
const AdmInst={currSite:null,currTypeId:null,currGroup:null,uploadItemId:null,init:()=>{document.getElementById('eq-site-select').innerHTML='<option value="">Selecione...</option>'+DB.data.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');document.getElementById('eq-panel').style.display='none'},onSiteChange:()=>{const v=document.getElementById('eq-site-select').value;if(!v){document.getElementById('eq-panel').style.display='none';return}AdmInst.currSite=parseInt(v);document.getElementById('eq-panel').style.display='block';document.getElementById('catalog-list').innerHTML=DB.data.types.map(t=>`<li class="list-item" onclick="AdmInst.selectType(${t.id})"><span>${t.name}</span> <i class="fas fa-chevron-right"></i></li>`).join('');AdmInst.renderGroups();document.getElementById('create-group-form').style.display='none';document.getElementById('item-list-box').style.display='none'},selectType:(tid)=>{AdmInst.currTypeId=tid;AdmInst.currGroup=null;const t=DB.data.types.find(x=>x.id===tid);document.getElementById('group-col-title').innerText=`PASSO 3: ${t.name}`;document.getElementById('create-group-form').style.display='block';document.getElementById('group-name-in').value=t.name;AdmInst.renderGroups();document.getElementById('item-list-box').style.display='none'},createGroup:()=>{const name=document.getElementById('group-name-in').value;const qty=parseInt(document.getElementById('group-qty-in').value);if(name&&qty>0){const gid=Date.now();DB.data.groups.push({id:gid,siteId:AdmInst.currSite,typeId:AdmInst.currTypeId,name:name});for(let i=0;i<qty;i++){let num=i+1;DB.data.equips.push({id:Date.now()+i,groupId:gid,siteId:AdmInst.currSite,name:`${name} ${num<10?'0'+num:num}`,image:null})}DB.save();AdmInst.renderGroups();AdmInst.selectGroup(gid);Toast.show('Grupo criado')}},renderGroups:()=>{const groups=DB.data.groups.filter(g=>g.siteId===AdmInst.currSite&&g.typeId===AdmInst.currTypeId);document.getElementById('group-list').innerHTML=groups.map(g=>{const count=DB.data.equips.filter(e=>e.groupId===g.id).length;return `<li class="list-item ${AdmInst.currGroup===g.id?'active':''}" onclick="AdmInst.selectGroup(${g.id})"><span>${g.name}</span> <span class="btn-sm btn-dark">${count}</span></li>`}).join('')},selectGroup:(gid)=>{AdmInst.currGroup=gid;AdmInst.renderGroups();document.getElementById('item-list-box').style.display='flex';AdmInst.renderItems()},addOneMore:()=>{if(!AdmInst.currGroup)return;const grp=DB.data.groups.find(g=>g.id===AdmInst.currGroup);const count=DB.data.equips.filter(e=>e.groupId===AdmInst.currGroup).length+1;DB.data.equips.push({id:Date.now(),groupId:AdmInst.currGroup,siteId:AdmInst.currSite,name:`${grp.name} ${count<10?'0'+count:count}`,image:null});DB.save();AdmInst.renderItems();AdmInst.renderGroups();Toast.show('Item adicionado')},renderItems:()=>{const items=DB.data.equips.filter(e=>e.groupId===AdmInst.currGroup);document.getElementById('item-list').innerHTML=items.map(e=>{const hasImg=e.image?'color:var(--primary)':'color:#ccc';return `<li class="list-item"><input style="border:none;background:transparent;width:100%" value="${e.name}" onchange="AdmInst.rename(${e.id},this.value)"><div style="display:flex; gap:5px"><button class="btn btn-sm" style="background:transparent; ${hasImg}; font-size:16px" onclick="AdmInst.triggerUpload(${e.id})"><i class="fas fa-camera"></i></button><button class="btn btn-sm btn-danger" onclick="AdmInst.delItem(${e.id})"><i class="fas fa-trash"></i></button></div></li>`}).join('')},rename:(id,v)=>{const e=DB.data.equips.find(x=>x.id===id);if(e){e.name=v;DB.save()}},delItem:(id)=>{if(confirm('Del?')){DB.data.equips=DB.data.equips.filter(x=>x.id!==id);DB.save();AdmInst.renderItems();AdmInst.renderGroups()}},triggerUpload:(id)=>{AdmInst.uploadItemId=id;document.getElementById('hidden-photo-input').click()},processPhoto:(input)=>{if(input.files&&input.files[0]){const reader=new FileReader();reader.onload=function(e){const img=new Image();img.src=e.target.result;img.onload=function(){const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');const MAX_WIDTH=800;const scale=MAX_WIDTH/img.width;canvas.width=MAX_WIDTH;canvas.height=img.height*scale;ctx.drawImage(img,0,0,canvas.width,canvas.height);const compressedData=canvas.toDataURL('image/jpeg',0.7);const item=DB.data.equips.find(x=>x.id===AdmInst.uploadItemId);if(item){item.image=compressedData;DB.save();AdmInst.renderItems();Toast.show('Foto salva')}}};reader.readAsDataURL(input.files[0])}}};

const Reports = {
    init: () => { document.getElementById('rep-date').valueAsDate = new Date(); document.getElementById('rep-site').innerHTML = '<option value="">...</option>' + DB.data.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''); },
    onSiteChange: () => {
        const sid = parseInt(document.getElementById('rep-site').value);
        const tree = document.getElementById('rep-tree-view');
        if(!sid) { tree.innerHTML = 'Selecione local'; return; }
        const groups = DB.data.groups.filter(g=>g.siteId===sid);
        tree.innerHTML = groups.map(g => `<div><input type="checkbox" class="rep-grp-chk" value="${g.id}" checked> ${g.name}</div>`).join('');
    },
    generate: () => {
        const date = document.getElementById('rep-date').value;
        const selGrps = Array.from(document.querySelectorAll('.rep-grp-chk:checked')).map(c=>parseInt(c.value));
        if(selGrps.length===0) return alert("Selecione itens");
        const items = DB.data.equips.filter(e=>selGrps.includes(e.groupId));
        const checks = DB.data.checks.filter(c=>c.date===date && items.find(i=>i.id===c.equipId));
        
        document.getElementById('kpi-total').innerText = checks.length;
        document.getElementById('kpi-fail').innerText = checks.filter(c=>c.status==='Erro').length;
        const ok = checks.filter(c=>c.status==='OK').length;
        document.getElementById('kpi-ok').innerText = checks.length ? Math.round((ok/checks.length)*100)+'%' : '0%';

        document.getElementById('rep-table-body').innerHTML = checks.map(c=>{
            const eq = DB.data.equips.find(e=>e.id===c.equipId);
            const grp = DB.data.groups.find(g=>g.id===eq.groupId);
            return `<tr><td style="padding:10px; border-bottom:1px solid #ddd"><b>${grp.name}</b><br>${eq.name}</td><td style="padding:10px; border-bottom:1px solid #ddd">${c.status}</td><td style="padding:10px; border-bottom:1px solid #ddd">${c.status==='Erro'?'Falha detectada':'-'}</td></tr>`;
        }).join('');
        document.getElementById('rep-results').style.display='block';
    }
};

const App = {
    init: () => { DB.init(); App.updateDash(); },
    toggleTheme: () => document.body.classList.toggle('dark-mode'),
    updateDash: () => {
        const today = new Date().toISOString().split('T')[0];
        const checks = DB.data.checks.filter(c => c.date === today);
        const osOpen = DB.data.os.filter(o => o.status === 'aberto').length;
        if(document.getElementById('dash-check')) {
            document.getElementById('dash-check').innerText = checks.length;
            document.getElementById('dash-os').innerText = osOpen;
        }
    }
};

const Nav = {
    toggleSub: (id) => document.getElementById(id).classList.toggle('open'),
    go: (v) => {
        document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
        document.getElementById('view-' + v).classList.add('active');
        if(v === 'hero') App.updateDash();
        if(v.includes('admin-')) {
            document.getElementById('sub-admin').classList.add('open');
            if(v==='admin-sites') AdmSites.render();
            if(v==='admin-types') AdmTypes.render();
            if(v==='admin-equips') AdmInst.init();
        }
        if(v.includes('checklist')) (v==='checklist-cctv'?ChecklistCCTV:ChecklistEq).init();
        if(v==='reports') Reports.init();
        if(v==='os') OS.init();
    }
};