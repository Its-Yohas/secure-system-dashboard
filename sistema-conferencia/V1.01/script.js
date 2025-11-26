const Toast = {
    show: (m) => {
        const x = document.getElementById("toast");
        if (x) {
            x.innerText = m;
            x.className = "show";
            setTimeout(() => { x.className = x.className.replace("show", "") }, 3000)
        }
    }
};

const DB = {
    // Garante que todas as tabelas existam
    data: { sites: [], types: [], groups: [], equips: [], checks: [], os: [], occurrences: [] },
    init: () => {
        try {
            const s = localStorage.getItem('sys_v11');
            if (s) {
                DB.data = JSON.parse(s);
                // Migração de segurança: Garante que arrays novos existam em dados antigos
                if (!DB.data.occurrences) DB.data.occurrences = [];
                if (!DB.data.os) DB.data.os = [];
            } else {
                DB.seed();
            }
        } catch (e) {
            console.error("Erro ao carregar banco:", e);
            alert("Dados corrompidos detectados. Recomendado resetar o sistema.");
        }
    },
    save: () => {
        localStorage.setItem('sys_v11', JSON.stringify(DB.data));
        App.updateDash();
    },
    seed: () => {
        DB.data.sites = [{ id: 1, name: 'Matriz SP' }];
        DB.data.types = [{ id: 10, name: 'Câmera IP', isVideo: true }];
        DB.save();
    },
    reset: () => {
        if (confirm('ATENÇÃO: Isso apagará TODOS os dados permanentemente. Continuar?')) {
            localStorage.removeItem('sys_v11');
            location.reload();
        }
    },
    export: () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(DB.data)], { type: 'application/json' }));
        a.download = 'backup_seguranca.json';
        a.click();
    },
    import: (inp) => {
        const fr = new FileReader();
        fr.onload = (e) => {
            if (confirm("Restaurar backup? Os dados atuais serão substituídos.")) {
                try {
                    DB.data = JSON.parse(e.target.result);
                    DB.save();
                    location.reload();
                } catch (err) {
                    alert("Arquivo inválido!");
                }
            }
        };
        fr.readAsText(inp.files[0]);
    }
};

const Auth = {
    login: () => {
        const userField = document.getElementById('login-user');
        const passField = document.getElementById('login-pass');
        
        // Tratamento de erro para evitar travamento se campos não existirem
        if (!userField || !passField) return alert("Erro interno no formulário de login.");

        // Normaliza texto (remove espaços e deixa minúsculo)
        const user = userField.value.trim().toLowerCase();
        const pass = passField.value;

        // Verifica Usuário (Senha opcional ou '123' se quiser travar)
        if (user === 'admin') { 
            document.getElementById('login-screen').style.display = 'none';
            try {
                App.init();
                Nav.go('hero');
            } catch (err) {
                alert("Erro crítico ao iniciar: " + err.message);
                console.error(err);
            }
        } else {
            alert("Usuário ou senha incorretos.\nTente usuário: admin");
        }
    }
};

const App = {
    init: () => { DB.init(); App.updateDash(); },
    toggleTheme: () => document.body.classList.toggle('dark-mode'),
    updateDash: () => {
        // Proteção contra elementos inexistentes
        const elRO = document.getElementById('dash-ro');
        const elOS = document.getElementById('dash-os');
        const elHealth = document.getElementById('dash-health');
        
        if (!elRO || !elOS || !elHealth) return;

        // 1. R.O. Pendentes
        const roCount = DB.data.occurrences ? DB.data.occurrences.filter(x => x.status === 'Aberto').length : 0;
        
        // 2. O.S. Abertas
        const osCount = DB.data.os ? DB.data.os.filter(o => o.status === 'aberto').length : 0;

        // 3. Saúde Câmeras
        let totalCams = 0;
        let brokenCams = 0;
        
        const vidTypeIds = DB.data.types.filter(t => t.isVideo).map(t => t.id);
        const allCams = DB.data.equips.filter(e => {
            const grp = DB.data.groups.find(g => g.id === e.groupId);
            return grp && vidTypeIds.includes(grp.typeId);
        });
        
        totalCams = allCams.length;
        if (totalCams > 0) {
            brokenCams = allCams.filter(cam => {
                return DB.data.os.find(os => os.equipId === cam.id && os.status === 'aberto');
            }).length;
        }

        const health = totalCams > 0 ? Math.round(((totalCams - brokenCams) / totalCams) * 100) : 100;

        // Atualiza UI
        elRO.innerText = roCount;
        elOS.innerText = osCount;
        elHealth.innerText = health + '%';

        const cardHealth = document.getElementById('card-health-bg');
        if (cardHealth) {
            // Remove classes antigas para garantir
            cardHealth.classList.remove('card-green', 'card-red');
            if (health < 90) {
                cardHealth.classList.add('card-red');
                cardHealth.style.borderBottomColor = '#ef4444';
                cardHealth.querySelector('.dash-icon').style.color = '#ef4444';
            } else {
                cardHealth.classList.add('card-green');
                cardHealth.style.borderBottomColor = '#10b981';
                cardHealth.querySelector('.dash-icon').style.color = '#10b981';
            }
        }
    }
};

const Nav = {
    toggleSub: (id) => {
        const el = document.getElementById(id);
        if(el) el.classList.toggle('open');
    },
    go: (v) => {
        document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
        const view = document.getElementById('view-' + v);
        if (view) view.classList.add('active');
        
        if (v === 'hero') App.updateDash();
        
        // Gerenciamento de Submenus
        if (v.includes('admin-')) {
            const sub = document.getElementById('sub-admin');
            if(sub) sub.classList.add('open');
            if (v === 'admin-sites') AdmSites.render();
            if (v === 'admin-types') AdmTypes.render();
            if (v === 'admin-equips') AdmInst.init();
        }
        
        // Inits específicos
        if (v === 'checklist-cctv') ChecklistCCTV.init();
        if (v === 'checklist-eq') ChecklistEq.init();
        if (v === 'reports') Reports.init();
        if (v === 'os') OS.init();
        if (v === 'occurrences') Occurrences.init();
    }
};

// --- O.S. SYSTEM ---
const OS = {
    init: () => {
        const sel = document.getElementById('os-filter-site');
        if(sel) {
            sel.innerHTML = '<option value="">Todos os Locais</option>' + DB.data.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            OS.render();
        }
    },
    render: () => {
        const siteFilter = document.getElementById('os-filter-site').value;
        const openContainer = document.getElementById('os-list-open');
        const doneContainer = document.getElementById('os-list-done');
        if(!openContainer || !doneContainer) return;

        let list = DB.data.os.sort((a, b) => b.id - a.id);
        if (siteFilter) list = list.filter(o => o.siteId == siteFilter);

        openContainer.innerHTML = '';
        doneContainer.innerHTML = '';

        if (list.length === 0) {
            openContainer.innerHTML = '<p style="padding:20px; color:#888; text-align:center">Nenhuma O.S.</p>';
        }

        list.forEach(os => {
            const equip = DB.data.equips.find(e => e.id === os.equipId);
            const group = equip ? DB.data.groups.find(g => g.id === equip.groupId) : { name: '?' };
            const site = equip ? DB.data.sites.find(s => s.id === equip.siteId) : { name: '?' };
            const itemName = equip ? equip.name : 'Item excluído';

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
                    <div>${btnFinish}</div>
                </div>
            </div>`;

            if (os.status === 'aberto') openContainer.innerHTML += html;
            else doneContainer.innerHTML += html;
        });
    },
    prompt: (equipId) => {
        document.getElementById('os-input-equip-id').value = equipId;
        document.getElementById('os-input-desc').value = '';
        document.getElementById('modal-os').style.display = 'flex';
    },
    closeModal: () => document.getElementById('modal-os').style.display = 'none',
    create: () => {
        const equipId = parseInt(document.getElementById('os-input-equip-id').value);
        const desc = document.getElementById('os-input-desc').value;
        const prio = document.getElementById('os-input-prio').value;

        if (!desc) return alert("Digite a descrição.");
        const equip = DB.data.equips.find(e => e.id === equipId);

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
        OS.render();
    },
    finish: (id) => {
        if (confirm("Confirmar conclusão da manutenção?")) {
            const os = DB.data.os.find(o => o.id === id);
            if (os) {
                os.status = 'concluido';
                os.dateClose = new Date().toLocaleDateString('pt-BR');
                DB.save();
                OS.render();
            }
        }
    },
    del: (id) => {
        if (confirm("ATENÇÃO: Deseja apagar esta O.S. permanentemente?")) {
            DB.data.os = DB.data.os.filter(o => o.id !== id);
            DB.save();
            OS.render();
            Toast.show("O.S. Excluída");
        }
    },
    printTicket: (id) => {
        const os = DB.data.os.find(o => o.id === id); if (!os) return;
        const equip = DB.data.equips.find(e => e.id === os.equipId);
        const group = equip ? DB.data.groups.find(g => g.id === equip.groupId) : { name: '?' };
        const site = equip ? DB.data.sites.find(s => s.id === equip.siteId) : { name: '?' };

        const win = window.open('', '', 'width=400,height=600');
        win.document.write(`
            <html><head><title>O.S. #${os.id}</title>
            <style>body{font-family:'Courier New',monospace;padding:20px}.box{border:2px solid #000;padding:15px}h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:10px}.label{font-weight:bold;margin-top:10px;display:block}.val{margin-bottom:10px;display:block}</style>
            </head><body>
            <div class="box"><h2>ORDEM DE SERVIÇO</h2>
            <span class="label">ID / DATA:</span><span class="val">#${os.id} - ${os.dateOpen}</span>
            <span class="label">LOCAL:</span><span class="val">${site.name}</span>
            <span class="label">EQUIPAMENTO:</span><span class="val">${group.name} > ${equip.name}</span>
            <span class="label">PRIORIDADE:</span><span class="val" style="text-transform:uppercase">${os.priority}</span>
            <div style="border:1px dashed #000;margin:15px 0"></div>
            <span class="label">DEFEITO RELATADO:</span><span class="val">${os.desc}</span>
            <div style="margin-top:40px;text-align:center;border-top:1px solid #000;padding-top:10px">Assinatura Técnico</div>
            </div><script>window.print();</script></body></html>
        `);
        win.document.close();
    }
};

// --- OCCURRENCES SYSTEM (RO) ---
const Occurrences = {
    init: () => {
        if (!DB.data.occurrences) { DB.data.occurrences = []; DB.save(); }
        const siteSel = document.getElementById('ro-site');
        if(siteSel) siteSel.innerHTML = DB.data.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const dateEl = document.getElementById('ro-date');
        const timeEl = document.getElementById('ro-time');
        if(dateEl) dateEl.value = now.toISOString().slice(0, 10);
        if(timeEl) timeEl.value = now.toTimeString().slice(0, 5);
        
        const idEl = document.getElementById('occ-display-id');
        if(idEl) idEl.innerText = "ID: RO-" + new Date().getFullYear() + "-" + (DB.data.occurrences.length + 1000);
        
        Occurrences.showTab('form');
    },
    showTab: (tab) => {
        const form = document.getElementById('occ-tab-form');
        const open = document.getElementById('occ-tab-open');
        const closed = document.getElementById('occ-tab-closed');
        
        if(form) form.style.display = tab === 'form' ? 'block' : 'none';
        if(open) open.style.display = tab === 'open' ? 'block' : 'none';
        if(closed) closed.style.display = tab === 'closed' ? 'block' : 'none';

        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(b => b.classList.remove('active'));
        if (tab === 'form' && btns[0]) btns[0].classList.add('active');
        if (tab === 'open') { if(btns[1]) btns[1].classList.add('active'); Occurrences.renderLists(); }
        if (tab === 'closed') { if(btns[2]) btns[2].classList.add('active'); Occurrences.renderLists(); }
    },
    toggleCamField: () => {
        const val = document.getElementById('ro-img-check').value;
        document.getElementById('ro-cam-box').style.display = val === 'Sim' ? 'block' : 'none';
    },
    toggleAreaField: () => {
        const chks = document.querySelectorAll('#ro-areas-list input[type="checkbox"]');
        let isOtherChecked = false;
        chks.forEach(c => { if (c.value === 'Outros' && c.checked) isOtherChecked = true; });
        document.getElementById('ro-area-other-box').style.display = isOtherChecked ? 'block' : 'none';
    },
    resetForm: () => {
        ['ro-resp', 'ro-local', 'ro-desc', 'ro-cam-name', 'ro-area-other-txt', 'ro-photo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('ro-type').value = "";
        document.getElementById('ro-envolvidos').selectedIndex = 0;
        document.getElementById('ro-turno').selectedIndex = 0;
        document.getElementById('ro-veiculo').selectedIndex = 0;
        document.getElementById('ro-sup-ok').selectedIndex = 0;
        document.getElementById('ro-img-check').value = "Não";
        document.querySelectorAll('.checkbox-grid input[type="checkbox"]').forEach(c => c.checked = false);
        Occurrences.toggleCamField();
        Occurrences.toggleAreaField();
        
        const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('ro-date').value = now.toISOString().slice(0, 10);
        document.getElementById('ro-time').value = now.toTimeString().slice(0, 5);
        document.getElementById('occ-display-id').innerText = "ID: RO-" + new Date().getFullYear() + "-" + (DB.data.occurrences.length + 1000);
    },
    save: () => {
        const siteId = document.getElementById('ro-site').value;
        const desc = document.getElementById('ro-desc').value;
        const type = document.getElementById('ro-type').value;
        if (!desc || !type) return alert("Preencha Tipo e Descrição!");

        let areas = [];
        document.querySelectorAll('#ro-areas-list input:checked').forEach(c => areas.push(c.value));
        if (areas.includes('Outros')) areas.push('Obs: ' + document.getElementById('ro-area-other-txt').value);

        let actions = [];
        document.querySelectorAll('#ro-actions-list input:checked').forEach(c => actions.push(c.value));

        let camInfo = "N/A";
        if (document.getElementById('ro-img-check').value === 'Sim') camInfo = document.getElementById('ro-cam-name').value;

        const finalizeSave = (pData) => {
            const newId = Date.now();
            const roNumber = "RO-" + new Date().getFullYear() + "-" + (DB.data.occurrences.length + 1000);
            DB.data.occurrences.push({
                id: newId, roNumber: roNumber, status: 'Aberto', siteId: siteId,
                date: document.getElementById('ro-date').value, time: document.getElementById('ro-time').value,
                resp: document.getElementById('ro-resp').value, local: document.getElementById('ro-local').value,
                envolvidos: document.getElementById('ro-envolvidos').value, turno: document.getElementById('ro-turno').value,
                type: type, desc: desc, veiculo: document.getElementById('ro-veiculo').value,
                supOk: document.getElementById('ro-sup-ok').value, camInfo: camInfo, areas: areas, actions: actions, photo: pData,
                endDate: null, endTime: null, conclusion: null
            });
            DB.save();
            Toast.show("R.O. Salvo! Formulário limpo.");
            Occurrences.resetForm();
        };

        const photoInput = document.getElementById('ro-photo');
        if (photoInput.files && photoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => finalizeSave(e.target.result);
            reader.readAsDataURL(photoInput.files[0]);
        } else { finalizeSave(null); }
    },
    openFinishModal: (id) => {
        const item = DB.data.occurrences.find(x => x.id === id); if (!item) return;
        document.getElementById('ro-finish-id').value = id;
        document.getElementById('ro-conclusion').value = '';
        const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('ro-end-date').value = now.toISOString().slice(0, 10);
        document.getElementById('ro-end-time').value = now.toTimeString().slice(0, 5);
        document.getElementById('modal-finish-ro').style.display = 'flex';
    },
    confirmFinish: () => {
        const id = parseInt(document.getElementById('ro-finish-id').value);
        const endDate = document.getElementById('ro-end-date').value;
        const endTime = document.getElementById('ro-end-time').value;
        const conclusion = document.getElementById('ro-conclusion').value;
        if (!conclusion) return alert("A conclusão é obrigatória!");
        const item = DB.data.occurrences.find(x => x.id === id);
        if (item) {
            item.status = 'Finalizado'; item.endDate = endDate; item.endTime = endTime; item.conclusion = conclusion;
            DB.save();
            document.getElementById('modal-finish-ro').style.display = 'none';
            Toast.show("R.O. Finalizado!");
            Occurrences.renderLists();
        }
    },
    printRO: (id) => {
        const item = DB.data.occurrences.find(x => x.id === id); if (!item) return;
        const site = DB.data.sites.find(s => s.id == item.siteId);
        const printWin = window.open('', '', 'width=800,height=900');
        printWin.document.write(`<html><head><title>${item.roNumber}</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:40px;color:#000}.header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.header h1{margin:0;font-size:20px}.header p{margin:5px 0 0;font-size:14px;color:#555}.section{margin-bottom:15px;border:1px solid #ccc;padding:10px;break-inside:avoid}.section h3{margin:0 0 10px;font-size:14px;background:#eee;padding:5px;border-bottom:1px solid #ccc;text-transform:uppercase}.row{display:flex;flex-wrap:wrap;margin-bottom:5px}.col{flex:1;min-width:200px;margin-bottom:5px}.label{font-weight:bold;display:block;font-size:10px;color:#666;text-transform:uppercase}.value{display:block;font-size:13px;font-weight:bold}.checklist{display:flex;flex-wrap:wrap;gap:5px}.tag{border:1px solid #000;padding:2px 5px;font-size:11px;border-radius:3px}.photo-box{text-align:center;margin-top:10px}.photo-box img{max-width:100%;max-height:300px;border:1px solid #ccc}.footer{margin-top:50px;display:flex;justify-content:space-between;text-align:center}.sign-line{border-top:1px solid #000;width:45%;padding-top:5px;font-size:11px}.st-aberto{color:red;border:2px solid red;display:inline-block;padding:5px 10px;font-weight:bold;transform:rotate(-5deg);float:right}.st-fechado{color:green;border:2px solid green;display:inline-block;padding:5px 10px;font-weight:bold;float:right}</style></head><body><div class="header"><div class="${item.status === 'Aberto' ? 'st-aberto' : 'st-fechado'}">${item.status.toUpperCase()}</div><h1>RELATÓRIO DE OCORRÊNCIA DE SEGURANÇA</h1><p>${item.roNumber}</p></div><div class="section"><h3>Dados Gerais</h3><div class="row"><div class="col"><span class="label">Site:</span><span class="value">${site ? site.name : '-'}</span></div><div class="col"><span class="label">Data Início:</span><span class="value">${item.date}</span></div><div class="col"><span class="label">Hora Início:</span><span class="value">${item.time}</span></div><div class="col"><span class="label">Turno:</span><span class="value">${item.turno}</span></div></div><div class="row"><div class="col"><span class="label">Tipo:</span><span class="value">${item.type}</span></div><div class="col"><span class="label">Envolvidos:</span><span class="value">${item.envolvidos}</span></div><div class="col"><span class="label">Veículo:</span><span class="value">${item.veiculo}</span></div></div></div><div class="section"><h3>Detalhamento</h3><div class="row"><div class="col"><span class="label">Local Exato:</span><span class="value">${item.local}</span></div><div class="col"><span class="label">Coord. Responsável:</span><span class="value">${item.resp}</span></div><div class="col"><span class="label">Sup. Informado:</span><span class="value">${item.supOk}</span></div></div><div class="row" style="margin-top:10px"><div class="col"><span class="label">Câmera:</span><span class="value">${item.camInfo}</span></div></div><div style="margin-top:10px"><span class="label">DESCRIÇÃO DOS FATOS:</span><div style="margin-top:5px;white-space:pre-wrap;font-size:13px;text-align:justify;line-height:1.4">${item.desc}</div></div></div><div class="section"><h3>Checklists</h3><span class="label">ÁREAS ENVOLVIDAS:</span><div class="checklist">${item.areas.length ? item.areas.map(a => `<span class="tag">${a}</span>`).join('') : 'Nenhuma'}</div><br><span class="label">AÇÕES TOMADAS:</span><div class="checklist">${item.actions.length ? item.actions.map(a => `<span class="tag">${a}</span>`).join('') : 'Nenhuma'}</div></div>${item.photo ? `<div class="section"><h3>Evidência Fotográfica</h3><div class="photo-box"><img src="${item.photo}"></div></div>` : ''}${item.status === 'Finalizado' ? `<div class="section" style="background:#f0fff4;border-color:#9ae6b4"><h3>Encerramento</h3><div class="row"><div class="col"><span class="label">Data Término:</span><span class="value">${item.endDate}</span></div><div class="col"><span class="label">Hora Término:</span><span class="value">${item.endTime}</span></div></div><div style="margin-top:10px"><span class="label">CONCLUSÃO / DESFECHO:</span><div style="font-size:13px;font-weight:bold;margin-top:5px">${item.conclusion}</div></div></div>` : ''}<div class="footer"><div class="sign-line">Assinatura Vigilante/Responsável</div><div class="sign-line">Assinatura Supervisor/Gestor</div></div><script>window.print();</script></body></html>`);
        printWin.document.close();
    },
    renderLists: () => {
        const openDiv = document.getElementById('occ-list-open-container');
        const closedDiv = document.getElementById('occ-list-closed-container');
        const list = DB.data.occurrences.sort((a, b) => b.id - a.id);

        openDiv.innerHTML = list.filter(x => x.status === 'Aberto').map(item => {
            return `
            <div class="card" style="border-top:4px solid #f59e0b">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px"><b>${item.roNumber}</b><span class="badge b-open">ABERTO</span></div>
                <div style="font-size:12px; color:#666; margin-bottom:10px"><b>${item.type}</b> <br> ${item.date} às ${item.time}</div>
                <p style="font-size:13px; margin-bottom:15px; background:#f9f9f9; padding:5px; height:60px; overflow:hidden">${item.desc.substring(0, 100)}...</p>
                <div style="display:flex; gap:5px">
                    <button class="btn btn-sm btn-dark" style="flex:1" onclick="Occurrences.printRO(${item.id})"><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="btn btn-sm btn-success" style="flex:1" onclick="Occurrences.openFinishModal(${item.id})">FINALIZAR</button>
                </div>
            </div>`;
        }).join('') || '<p style="color:#888">Nenhuma pendente.</p>';

        closedDiv.innerHTML = list.filter(x => x.status === 'Finalizado').map(item => {
            return `
            <div class="list-item">
                <div><b>${item.roNumber}</b> - ${item.type}<div style="font-size:11px; color:#888">Encerrado em: ${item.endDate}</div></div>
                <div><button class="btn btn-sm btn-dark" onclick="Occurrences.printRO(${item.id})"><i class="fas fa-file-pdf"></i> PDF / VER</button></div>
            </div>`;
        }).join('') || '<p style="color:#888">Histórico vazio.</p>';
    }
};

// --- CHECKLISTS & ADMIN ---
const ChecklistCCTV = {
    init: () => { document.getElementById('cctv-date').valueAsDate = new Date(); document.getElementById('cctv-site').innerHTML = '<option value="">...</option>' + DB.data.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('') },
    clear: () => document.getElementById('cctv-container').innerHTML = '',
    onSiteChange: () => {
        const sid = parseInt(document.getElementById('cctv-site').value);
        const groups = DB.data.groups.filter(g => g.siteId === sid);
        const grpSel = document.getElementById('cctv-group');
        const vidTypes = DB.data.types.filter(t => t.isVideo).map(t => t.id);
        const vidGroups = groups.filter(g => vidTypes.includes(g.typeId));
        grpSel.innerHTML = '<option value="">Selecione...</option>' + vidGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        grpSel.disabled = false; ChecklistCCTV.clear();
    },
    load: () => {
        const gid = parseInt(document.getElementById('cctv-group').value);
        const date = document.getElementById('cctv-date').value;
        if (!gid) return alert("Selecione grupo");
        const items = DB.data.equips.filter(e => e.groupId === gid);
        const container = document.getElementById('cctv-container');
        container.className = "cctv-grid";
        if (items.length === 0) return container.innerHTML = 'Vazio';
        container.innerHTML = items.map(i => {
            const check = DB.data.checks.find(c => c.date === date && c.equipId === i.id);
            const st = check ? check.status : 'Pendente';
            const img = i.image ? `<img src="${i.image}" class="cctv-feed" onclick="document.getElementById('modal-img-tag').src='${i.image}';document.getElementById('modal-photo').style.display='flex'">` : `<div class="cctv-noise">NO SIGNAL</div>`;
            return `<div class="cctv-card st-${st.toLowerCase()}">${st === 'OK' ? '<div style="position:absolute;top:10px;right:10px;color:#10b981;font-weight:bold;text-shadow:0 0 5px #000">● REC</div>' : ''}${img}<div class="cctv-hud"><div class="cctv-name">${i.name}</div><select class="cctv-select" onchange="Logic.saveCheck(${i.id}, this.value, 'cctv')"><option ${st == 'Pendente' ? 'selected' : ''}>Pendente</option><option ${st == 'OK' ? 'selected' : ''}>OK</option><option ${st == 'Erro' ? 'selected' : ''}>Erro</option></select></div></div>`;
        }).join('');
    }
};

const ChecklistEq = {
    init: () => { document.getElementById('eq-date').valueAsDate = new Date(); document.getElementById('eq-site').innerHTML = '<option value="">...</option>' + DB.data.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('') },
    clear: () => document.getElementById('eq-container').innerHTML = '',
    onSiteChange: () => {
        const sid = parseInt(document.getElementById('eq-site').value);
        const groups = DB.data.groups.filter(g => g.siteId === sid);
        const grpSel = document.getElementById('eq-group');
        const vidTypes = DB.data.types.filter(t => t.isVideo).map(t => t.id);
        const nonVidGroups = groups.filter(g => !vidTypes.includes(g.typeId));
        grpSel.innerHTML = '<option value="">Selecione...</option>' + nonVidGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        grpSel.disabled = false; ChecklistEq.clear();
    },
    load: () => {
        const gid = parseInt(document.getElementById('eq-group').value);
        const date = document.getElementById('eq-date').value;
        if (!gid) return alert("Selecione grupo");
        const items = DB.data.equips.filter(e => e.groupId === gid);
        const container = document.getElementById('eq-container');
        container.className = "list-group";
        if (items.length === 0) return container.innerHTML = 'Vazio';
        container.innerHTML = items.map(i => {
            const check = DB.data.checks.find(c => c.date === date && c.equipId === i.id);
            const st = check ? check.status : 'Pendente';
            let bg = ''; if (st === 'OK') bg = 'background:rgba(16,185,129,0.1); border-left:4px solid #10b981'; if (st === 'Erro') bg = 'background:rgba(239,68,68,0.1); border-left:4px solid #ef4444';
            return `<div class="list-item" style="${bg}"><b>${i.name}</b><select class="cctv-select" style="width:100px; height:30px" onchange="Logic.saveCheck(${i.id}, this.value, 'eq')"><option ${st == 'Pendente' ? 'selected' : ''}>Pendente</option><option ${st == 'OK' ? 'selected' : ''}>OK</option><option ${st == 'Erro' ? 'selected' : ''}>Erro</option></select></div>`;
        }).join('');
    }
};

const AdmSites = { render: () => { document.getElementById('site-list').innerHTML = DB.data.sites.map(s => `<li class="list-item"><b>${s.name}</b><button class="btn btn-sm btn-danger" onclick="AdmSites.del(${s.id})"><i class="fas fa-trash"></i></button></li>`).join('') }, add: () => { const n = document.getElementById('site-name').value; if (n) { DB.data.sites.push({ id: Date.now(), name: n }); DB.save(); document.getElementById('site-name').value = ''; AdmSites.render(); Toast.show('Site add') } }, del: (id) => { if (confirm('Del?')) { DB.data.sites = DB.data.sites.filter(x => x.id !== id); DB.save(); AdmSites.render() } } };
const AdmTypes = { render: () => { document.getElementById('type-list').innerHTML = DB.data.types.map(t => `<li class="list-item"><span>${t.isVideo ? '📷' : ''} ${t.name}</span><button class="btn btn-sm btn-danger" onclick="AdmTypes.del(${t.id})"><i class="fas fa-trash"></i></button></li>`).join('') }, add: () => { const n = document.getElementById('type-name').value; const c = document.getElementById('type-cat').value; if (n) { DB.data.types.push({ id: Date.now(), name: n, isVideo: c === 'video' }); DB.save(); document.getElementById('type-name').value = ''; AdmTypes.render(); Toast.show('Tipo add') } }, del: (id) => { if (confirm('Del?')) { DB.data.types = DB.data.types.filter(x => x.id !== id); DB.save(); AdmTypes.render() } } };
const AdmInst = {
    currSite: null, currTypeId: null, currGroup: null, uploadItemId: null, init: () => { document.getElementById('eq-site-select').innerHTML = '<option value="">Selecione...</option>' + DB.data.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join(''); document.getElementById('eq-panel').style.display = 'none' },
    onSiteChange: () => { const v = document.getElementById('eq-site-select').value; if (!v) { document.getElementById('eq-panel').style.display = 'none'; return } AdmInst.currSite = parseInt(v); document.getElementById('eq-panel').style.display = 'block'; document.getElementById('catalog-list').innerHTML = DB.data.types.map(t => `<li class="list-item" onclick="AdmInst.selectType(${t.id})"><span>${t.name}</span> <i class="fas fa-chevron-right"></i></li>`).join(''); AdmInst.renderGroups(); document.getElementById('create-group-form').style.display = 'none'; document.getElementById('item-list-box').style.display = 'none' },
    selectType: (tid) => { AdmInst.currTypeId = tid; AdmInst.currGroup = null; const t = DB.data.types.find(x => x.id === tid); document.getElementById('group-col-title').innerText = `PASSO 3: ${t.name}`; document.getElementById('create-group-form').style.display = 'block'; document.getElementById('group-name-in').value = t.name; AdmInst.renderGroups(); document.getElementById('item-list-box').style.display = 'none' },
    createGroup: () => { const name = document.getElementById('group-name-in').value; const qty = parseInt(document.getElementById('group-qty-in').value); if (name && qty > 0) { const gid = Date.now(); DB.data.groups.push({ id: gid, siteId: AdmInst.currSite, typeId: AdmInst.currTypeId, name: name }); for (let i = 0; i < qty; i++) { let num = i + 1; DB.data.equips.push({ id: Date.now() + i, groupId: gid, siteId: AdmInst.currSite, name: `${name} ${num < 10 ? '0' + num : num}`, image: null }) } DB.save(); AdmInst.renderGroups(); AdmInst.selectGroup(gid); Toast.show('Grupo criado') } },
    renderGroups: () => { const groups = DB.data.groups.filter(g => g.siteId === AdmInst.currSite && g.typeId === AdmInst.currTypeId); document.getElementById('group-list').innerHTML = groups.map(g => { const count = DB.data.equips.filter(e => e.groupId === g.id).length; return `<li class="list-item ${AdmInst.currGroup === g.id ? 'active' : ''}" onclick="AdmInst.selectGroup(${g.id})"><span>${g.name}</span> <span class="btn-sm btn-dark">${count}</span></li>` }).join('') },
    selectGroup: (gid) => { AdmInst.currGroup = gid; AdmInst.renderGroups(); document.getElementById('item-list-box').style.display = 'flex'; AdmInst.renderItems() },
    addOneMore: () => { if (!AdmInst.currGroup) return; const grp = DB.data.groups.find(g => g.id === AdmInst.currGroup); const count = DB.data.equips.filter(e => e.groupId === AdmInst.currGroup).length + 1; DB.data.equips.push({ id: Date.now(), groupId: AdmInst.currGroup, siteId: AdmInst.currSite, name: `${grp.name} ${count < 10 ? '0' + count : count}`, image: null }); DB.save(); AdmInst.renderItems(); AdmInst.renderGroups(); Toast.show('Item adicionado') },
    renderItems: () => { const items = DB.data.equips.filter(e => e.groupId === AdmInst.currGroup); document.getElementById('item-list').innerHTML = items.map(e => { const hasImg = e.image ? 'color:var(--primary)' : 'color:#ccc'; return `<li class="list-item"><input style="border:none;background:transparent;width:100%" value="${e.name}" onchange="AdmInst.rename(${e.id},this.value)"><div style="display:flex; gap:5px"><button class="btn btn-sm" style="background:transparent; ${hasImg}; font-size:16px" onclick="AdmInst.triggerUpload(${e.id})"><i class="fas fa-camera"></i></button><button class="btn btn-sm btn-danger" onclick="AdmInst.delItem(${e.id})"><i class="fas fa-trash"></i></button></div></li>` }).join('') },
    rename: (id, v) => { const e = DB.data.equips.find(x => x.id === id); if (e) { e.name = v; DB.save() } },
    delItem: (id) => { if (confirm('Del?')) { DB.data.equips = DB.data.equips.filter(x => x.id !== id); DB.save(); AdmInst.renderItems(); AdmInst.renderGroups() } },
    triggerUpload: (id) => { AdmInst.uploadItemId = id; document.getElementById('hidden-photo-input').click() },
    processPhoto: (input) => { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function (e) { const img = new Image(); img.src = e.target.result; img.onload = function () { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX_WIDTH = 800; const scale = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const compressedData = canvas.toDataURL('image/jpeg', 0.7); const item = DB.data.equips.find(x => x.id === AdmInst.uploadItemId); if (item) { item.image = compressedData; DB.save(); AdmInst.renderItems(); Toast.show('Foto salva') } } }; reader.readAsDataURL(input.files[0]) } }
};

const Reports = {
    init: () => { document.getElementById('rep-date').valueAsDate = new Date(); document.getElementById('rep-site').innerHTML = '<option value="">...</option>' + DB.data.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('') },
    onSiteChange: () => { const sid = parseInt(document.getElementById('rep-site').value); const tree = document.getElementById('rep-tree-view'); if (!sid) { tree.innerHTML = 'Selecione local'; return } const groups = DB.data.groups.filter(g => g.siteId === sid); tree.innerHTML = groups.map(g => `<div><input type="checkbox" class="rep-grp-chk" value="${g.id}" checked> ${g.name}</div>`).join('') },
    generate: () => {
        const date = document.getElementById('rep-date').value; const selGrps = Array.from(document.querySelectorAll('.rep-grp-chk:checked')).map(c => parseInt(c.value)); if (selGrps.length === 0) return alert("Selecione itens");
        const items = DB.data.equips.filter(e => selGrps.includes(e.groupId)); const checks = DB.data.checks.filter(c => c.date === date && items.find(i => i.id === c.equipId));
        document.getElementById('kpi-total').innerText = checks.length; document.getElementById('kpi-fail').innerText = checks.filter(c => c.status === 'Erro').length; const ok = checks.filter(c => c.status === 'OK').length; document.getElementById('kpi-ok').innerText = checks.length ? Math.round((ok / checks.length) * 100) + '%' : '0%';
        document.getElementById('rep-table-body').innerHTML = checks.map(c => { const eq = DB.data.equips.find(e => e.id === c.equipId); const grp = DB.data.groups.find(g => g.id === eq.groupId); return `<tr><td style="padding:10px; border-bottom:1px solid #ddd"><b>${grp.name}</b><br>${eq.name}</td><td style="padding:10px; border-bottom:1px solid #ddd">${c.status}</td><td style="padding:10px; border-bottom:1px solid #ddd">${c.status === 'Erro' ? 'Falha detectada' : '-'}</td></tr>` }).join(''); document.getElementById('rep-results').style.display = 'block'
    }
};