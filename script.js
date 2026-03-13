/* App core (v5) — يدير data + الرندر + التصدير باستخدام قوالب */
const App = (function(){
  const LS_KEY = 'novelnest_data_v5';
  const THEME_KEY = 'novelnest_theme_v1';
  const MAKER_EN_LIGHT = 'Sun King';
  const MAKER_EN_DARK = 'Dark King';
  let DATA = null;

  /* helpers */
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.from(document.querySelectorAll(s)); }
  function now(){ return Date.now(); }
  function escapeHtml(str){
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"'`=\/]/g, function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s]; });
  }
  function sanitizeFolderName(name){ return String(name).trim().replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\-_]/g,''); }
  function formatChapterFileName(num, title, ext='html'){ const n = String(num).padStart(2,'0'); const clean = (title || `الفصل-${n}`).replace(/\s+/g,'-').replace(/[^\u0600-\u06FF\w\-]/g,''); return `${n}-${clean}.${ext}`; }

  /* storage */
  function loadLocal(){
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try { DATA = JSON.parse(raw); return DATA; } catch(e){ console.error('parse local failed', e); }
    }
    DATA = { _updated: now(), novels: [] };
    saveLocal(); // ensure exists
    return DATA;
  }
  function saveLocal(){
    DATA._updated = now();
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
  }

  /* theme & maker */
  function applyTheme(theme){
    if (theme === 'dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(THEME_KEY, theme);
    qsa('#theme-toggle').forEach(b => b.textContent = theme === 'dark' ? '🌙' : '☀️');
    updateMakerSignature();
  }
  function toggleTheme(){ const cur = localStorage.getItem(THEME_KEY) || 'light'; applyTheme(cur === 'dark' ? 'light' : 'dark'); }
  function getMakerLabel(){ const theme = localStorage.getItem(THEME_KEY) || 'light'; return theme === 'dark' ? MAKER_EN_DARK : MAKER_EN_LIGHT; }
  function updateMakerSignature(){ const maker = getMakerLabel(); qsa('.footer').forEach(f => { const sm = f.querySelector('small'); if (sm) sm.textContent = `صنع بواسطة: ${maker}`; else f.innerHTML = `<small>صنع بواسطة: ${maker}</small>`; }); }

  /* render index */
  function renderIndex(){
    const root = qs('#novel-list'); if (!root) return;
    root.innerHTML = '';
    if (!DATA.novels || DATA.novels.length === 0) { root.innerHTML = '<p class="small">لا توجد روايات بعد. افتح لوحة التحكم لإضافة أول رواية.</p>'; updateMakerSignature(); return; }
    DATA.novels.forEach(n => {
      const card = document.createElement('article'); card.className = 'card';
      const cover = n.coverFileName ? (`novels/${n.folder}/${n.coverFileName}`) : (n.cover || '');
      const cnt = (n.chapters || []).length;
      card.innerHTML = `${ cover ? `<img loading="lazy" src="${cover}" alt="${escapeHtml(n.title)} cover" onerror="this.style.display=\'none\'">` : '' }
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.summary || '')}</p>
        <div class="meta">
          <span class="small">الفصول: ${cnt}</span>
          <a class="btn" href="novel.html?novel=${encodeURIComponent(n.folder)}">اقرأ</a>
        </div>`;
      root.appendChild(card);
    });
    updateMakerSignature();
  }

  /* render novel page */
  function renderNovelPageFromURL(){
    const params = new URLSearchParams(location.search);
    const folder = params.get('novel');
    if (!folder) { qs('#novel-page').innerHTML = '<p>الرواية غير محددة.</p>'; updateMakerSignature(); return; }
    const novel = (DATA.novels || []).find(x => x.folder === folder);
    if (!novel){ qs('#novel-page').innerHTML = '<p>الرواية غير موجودة.</p>'; updateMakerSignature(); return; }
    const root = qs('#novel-page');
    const coverSrc = novel.coverFileName ? `novels/${novel.folder}/${novel.coverFileName}` : (novel.cover || '');
    const chaptersHTML = (novel.chapters || []).map((ch, idx) => {
      const fname = ch.file || formatChapterFileName(idx+1, ch.title);
      return `<li><a href="chapter.html?novel=${encodeURIComponent(novel.folder)}&chapter=${encodeURIComponent(fname)}">${escapeHtml(ch.title)}</a></li>`;
    }).join('');
    root.innerHTML = `<div class="card">${ coverSrc ? `<img src="${coverSrc}" alt="${escapeHtml(novel.title)}">` : '' }
      <h2>${escapeHtml(novel.title)}</h2>
      <p class="small">${escapeHtml(novel.summary || '')}</p>
      <h3>الفصول</h3>
      <ol>${chaptersHTML}</ol>
    </div>`;
    updateMakerSignature();
  }

  /* render chapter page */
  async function renderChapterFromURL(){
    const params = new URLSearchParams(location.search);
    const folder = params.get('novel'); const chapterFile = params.get('chapter');
    if (!folder || !chapterFile) { qs('#chapter-container').innerHTML = '<p>الرواية أو الفصل غير محدد.</p>'; updateMakerSignature(); return; }
    const novel = (DATA.novels || []).find(x => x.folder === folder);
    if (!novel){ qs('#chapter-container').innerHTML = '<p>الرواية غير موجودة.</p>'; updateMakerSignature(); return; }

    const chapterIndex = (novel.chapters || []).findIndex(c => (c.file || '') === chapterFile || (c.file === undefined && formatChapterFileName((novel.chapters||[]).indexOf(c)+1, c.title) === chapterFile));
    // محاولة جلب الملف من مجلد novels (إذا كنت قد نشرت ملفات ثابتة) وإلا استخدام المحتوى المضمن في DATA
    let text = '';
    try {
      const resp = await fetch(`novels/${folder}/chapters/${chapterFile}`);
      if (resp.ok) text = await resp.text();
    } catch(e){}
    if (!text) {
      const ch = (novel.chapters || []).find(c => (c.file || formatChapterFileName((novel.chapters||[]).indexOf(c)+1, c.title)) === chapterFile);
      text = ch && ch.content ? ch.content : 'لا يوجد نص متاح لهذا الفصل.';
    }

    const container = qs('#chapter-container');
    const title = (novel.chapters && novel.chapters[chapterIndex] && novel.chapters[chapterIndex].title) || chapterFile;
    container.innerHTML = `<h2>${escapeHtml(novel.title)} — ${escapeHtml(title)}</h2><article><p>${escapeHtml(text)}</p></article>`;
    // أزرار السابق/التالي
    const prevBtn = qs('#prev-btn'); const nextBtn = qs('#next-btn'); const tocBtn = qs('#toc-btn');
    tocBtn.href = `novel.html?novel=${encodeURIComponent(folder)}`;
    const total = (novel.chapters || []).length;
    if (chapterIndex > 0) {
      const prevFile = (novel.chapters[chapterIndex-1].file) || formatChapterFileName(chapterIndex, novel.chapters[chapterIndex-1].title);
      prevBtn.disabled = false; prevBtn.onclick = () => location.href = `chapter.html?novel=${encodeURIComponent(folder)}&chapter=${encodeURIComponent(prevFile)}`;
    } else prevBtn.disabled = true;
    if (chapterIndex >=0 && chapterIndex < total-1) {
      const nextFile = (novel.chapters[chapterIndex+1].file) || formatChapterFileName(chapterIndex+2, novel.chapters[chapterIndex+1].title);
      nextBtn.disabled = false; nextBtn.onclick = () => location.href = `chapter.html?novel=${encodeURIComponent(folder)}&chapter=${encodeURIComponent(nextFile)}`;
    } else nextBtn.disabled = true;

    const backLink = qs('#link-back-to-novel'); if (backLink) backLink.href = `novel.html?novel=${encodeURIComponent(folder)}`;
    updateMakerSignature();
  }

  /* admin UI */
  function renderAdminUI(){
    const sel = qs('#select-novel-for-chapter'); const list = qs('#novels-list');
    const refresh = () => {
      sel.innerHTML = (DATA.novels || []).map(n => `<option value="${escapeHtml(n.folder)}">${escapeHtml(n.title)}</option>`).join('') || '<option value="">لا توجد روايات</option>';
      list.innerHTML = (DATA.novels || []).map(n => `<div class="novel-item"><strong>${escapeHtml(n.title)}</strong> <span class="small">(${escapeHtml(n.folder)})</span><p class="small">${escapeHtml(n.summary || '')}</p><div class="actions small">الفصول: ${(n.chapters||[]).length}</div></div>`).join('') || '<p class="small">لا توجد روايات.</p>';
    };
    refresh();

    qs('#create-novel-btn').onclick = async () => {
      const title = qs('#new-novel-title').value.trim(); const folderRaw = qs('#new-novel-folder').value.trim(); const summary = qs('#new-novel-summary').value.trim(); const coverInput = qs('#new-novel-cover');
      if (!title || !folderRaw) return alert('ادخل عنوان الرواية واسم المجلد.');
      const folder = sanitizeFolderName(folderRaw);
      if (DATA.novels.some(x => x.folder === folder)) return alert('اسم المجلد مستخدم بالفعل.');
      let coverData = null; let coverFileName = null;
      if (coverInput.files && coverInput.files[0]) { const f = coverInput.files[0]; coverFileName = `cover${getFileExt(f.name)}`; coverData = await fileToDataURL(f); }
      const novel = { title, folder, summary, cover: coverData, coverFileName, chapters: [] };
      DATA.novels.push(novel); saveLocal(); qs('#new-novel-title').value=''; qs('#new-novel-folder').value=''; qs('#new-novel-summary').value=''; qs('#new-novel-cover').value=''; refresh(); renderIndex(); alert('تم إنشاء الرواية محليًا.');
    };

    qs('#create-chapter-btn').onclick = () => {
      const folder = sel.value; const title = qs('#new-chapter-title').value.trim(); const content = qs('#new-chapter-content').value.trim();
      if (!folder) return alert('اختر رواية أولاً.'); if (!title || !content) return alert('اكتب عنوان الفصل ومحتواه.');
      const novel = DATA.novels.find(x => x.folder === folder); if (!novel) return alert('الرواية غير موجودة.');
      const idx = (novel.chapters || []).length + 1; const fname = formatChapterFileName(idx, title, 'html');
      const chapter = { title, file: fname, content };
      novel.chapters = novel.chapters || []; novel.chapters.push(chapter); saveLocal(); qs('#new-chapter-title').value=''; qs('#new-chapter-content').value=''; refresh(); renderIndex(); alert('تم إضافة الفصل محليًا.');
    };

    qs('#download-chapter-btn').onclick = () => {
      const folder = sel.value; if (!folder) return alert('اختر رواية أولاً.'); const novel = DATA.novels.find(x => x.folder === folder); if (!novel) return alert('الرواية غير موجودة.'); const last = (novel.chapters || []).slice(-1)[0]; if (!last) return alert('لا توجد فصول.'); const blob = new Blob([last.content || ''], { type:'text/plain;charset=utf-8' }); saveAs(blob, (last.file || 'chapter.html').replace('.html','.txt'));
    };

    qs('#import-data-btn').onclick = () => { qs('#import-file-input').click(); };
    qs('#import-file-input').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return; const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const obj = JSON.parse(ev.target.result); if (!Array.isArray(obj.novels)) return alert('ملف غير صالح.'); DATA = obj; saveLocal(); renderAdminUI(); renderIndex(); alert('تم استيراد البيانات.');
        } catch(err){ alert('خطأ في قراءة الملف'); }
      };
      reader.readAsText(f);
    };

    qs('#clear-data-btn').onclick = () => { if (!confirm('هل تريد مسح كل البيانات المحلية؟')) return; DATA = { _updated: now(), novels: [] }; saveLocal(); renderAdminUI(); renderIndex(); };
    qs('#download-data-btn').onclick = () => { const blob = new Blob([JSON.stringify(DATA, null, 2)], { type:'application/json' }); saveAs(blob, 'data.json'); };
    qs('#generate-zip-btn').onclick = async () => { try { await generateStaticZip(); } catch(e){ console.error(e); alert('فشل التصدير: ' + e.message); } };
  }

  /* utils */
  function fileToDataURL(file){ return new Promise((res, rej) => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); }); }
  function getFileExt(name){ const m = name.match(/\.[0-9a-z]+$/i); return m ? m[0] : '.png'; }
  async function fetchResourceText(path){ try { const r = await fetch(path, {cache:'no-store'}); if (r.ok) return await r.text(); } catch(e){} return null; }

  /* generate ZIP using templates */
  async function generateStaticZip(){
    if (typeof JSZip === 'undefined') throw new Error('JSZip غير محمّل.');
    const zip = new JSZip();

    // include data.json
    zip.file('data.json', JSON.stringify(DATA, null, 2));

    // include style.css at root
    const styleText = await fetchResourceText('style.css') || '';
    zip.file('style.css', styleText);

    // load templates
    const tplIndex = await fetchResourceText('templates/index_template.html');
    const tplNovel = await fetchResourceText('templates/novel_template.html');
    const tplChapter = await fetchResourceText('templates/chapter_template.html');
    if (!tplIndex || !tplNovel || !tplChapter) throw new Error('قوالب غير موجودة أو لا يمكن جلبها. تأكد أن ملفات القوالب موجودة في /templates.');

    // build cards for index
    const cards = (DATA.novels || []).map(n => {
      const cover = n.coverFileName ? (`novels/${n.folder}/${n.coverFileName}`) : (n.cover || '');
      const coverTag = cover ? `<img src="${cover}" alt="${escapeHtml(n.title)}">` : '';
      const chaptersCount = (n.chapters || []).length;
      return `<article class="card">${coverTag}<h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary || '')}</p><div class="meta"><span class="small">الفصول: ${chaptersCount}</span><a class="btn" href="novels/${n.folder}/index.html">اقرأ</a></div></article>`;
    }).join('\n') || '<p class="small">لا توجد روايات بعد.</p>';

    // create static index using template (tplIndex)
    const staticIndex = tplIndex.replace('{{CARDS}}', cards);
    zip.file('index.html', staticIndex);

    // for each novel create folder and files
    for (const novel of (DATA.novels || [])){
      const folder = `novels/${novel.folder}/`;
      const chaptersFolder = folder + 'chapters/';
      zip.folder(folder);
      zip.folder(chaptersFolder);

      // cover (if base64 present)
      if (novel.cover && novel.coverFileName) {
        const parts = novel.cover.split(',');
        const data = parts[1];
        zip.file(folder + novel.coverFileName, data, { base64: true });
      }

      // build chapter list HTML for novel page
      const chapterList = (novel.chapters || []).map((ch, idx) => {
        const fname = ch.file || formatChapterFileName(idx+1, ch.title, 'html');
        return `<li><a href="chapters/${fname}">${escapeHtml(ch.title)}</a></li>`;
      }).join('\n');

      const coverTag = novel.coverFileName ? `<img src="${novel.coverFileName}" alt="${escapeHtml(novel.title)}">` : (novel.cover ? `<img src="${novel.cover}" alt="${escapeHtml(novel.title)}">` : '');

      // novel page
      const novelHtml = tplNovel
        .replace('{{NOVEL_TITLE}}', escapeHtml(novel.title))
        .replace('{{NOVEL_SUMMARY}}', escapeHtml(novel.summary || ''))
        .replace('{{COVER_TAG}}', coverTag)
        .replace('{{CHAPTER_LIST}}', chapterList);
      zip.file(folder + 'index.html', novelHtml);

      // chapters (use chapter template)
      const chapters = novel.chapters || [];
      for (let i=0;i<chapters.length;i++){
        const ch = chapters[i];
        const chFile = ch.file || formatChapterFileName(i+1, ch.title, 'html');
        const prev = i>0 ? (chapters[i-1].file || formatChapterFileName(i, chapters[i-1].title, 'html')) : '';
        const next = i<chapters.length-1 ? (chapters[i+1].file || formatChapterFileName(i+2, chapters[i+1].title, 'html')) : '';
        const chHtml = tplChapter
          .replace(/{{NOVEL_TITLE}}/g, escapeHtml(novel.title))
          .replace(/{{CHAPTER_TITLE}}/g, escapeHtml(ch.title))
          .replace(/{{CHAPTER_CONTENT}}/g, escapeHtml(ch.content || ''))
          .replace(/{{PREV_DISABLED}}/g, prev ? '' : 'disabled')
          .replace(/{{NEXT_DISABLED}}/g, next ? '' : 'disabled')
          .replace(/{{PREV_LINK}}/g, prev)
          .replace(/{{NEXT_LINK}}/g, next);
        zip.file(chaptersFolder + chFile, chHtml);
      }
    }

    zip.file('README.txt', 'مُولَّد بواسطة NovelNest — ارفع المحتوى إلى استضافة ثابتة.');
    const blob = await zip.generateAsync({type:'blob'});
    const zipName = (qs('#zip-file-name')?.value.trim() || 'novelnest-export.zip');
    saveAs(blob, zipName);
  }

  /* init */
  async function init(){
    loadLocal();
    const theme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(theme);
    qsa('#theme-toggle').forEach(b => b.addEventListener('click', toggleTheme));
    if (qs('#admin-root')) renderAdminUI();
    if (qs('#novel-list')) renderIndex();
    if (qs('#novel-page')) renderNovelPageFromURL();
    if (qs('#chapter-container')) renderChapterFromURL();
  }

  return { init, renderIndex, renderNovelPageFromURL, renderChapterFromURL, renderAdminUI };
})();