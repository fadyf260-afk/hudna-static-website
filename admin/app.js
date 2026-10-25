const form = document.getElementById('post-form');
const dialog = document.getElementById('editor');
const rows = document.getElementById('article-rows');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let posts = [];
let editingSlug = null;
let baseRevision = '';
let siteRevision = '';

function notify(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 5200);
}

function safeContent(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  const allowed = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'BLOCKQUOTE', 'A', 'BR']);
  for (const node of [...root.querySelectorAll('*')].reverse()) {
    if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); continue; }
    for (const attribute of [...node.attributes]) {
      if (node.tagName !== 'A' || attribute.name !== 'href') node.removeAttribute(attribute.name);
    }
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (!/^(https:\/\/|\/(?!\/)|#)/.test(href)) node.removeAttribute('href');
      if (href.startsWith('https://')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
    }
  }
  return root.innerHTML;
}

function seoScore(post) {
  return Number(Boolean(post.title && post.title.length <= 60)) +
    Number(Boolean(post.description && post.description.length >= 70 && post.description.length <= 160)) +
    Number(Boolean(post.content?.includes('<h2'))) + Number(Boolean(post.slug));
}

function render() {
  const query = document.getElementById('filter-search').value.trim().toLocaleLowerCase('ar');
  const status = document.getElementById('filter-status').value;
  const visible = posts.filter(post => post.title.toLocaleLowerCase('ar').includes(query) && (status === 'all' || post.status === status)).sort((a, b) => b.date.localeCompare(a.date));
  rows.innerHTML = visible.length ? visible.map(post => `<tr>
    <td><strong>${esc(post.title)}</strong><small>/blog/${esc(post.slug)}/</small></td>
    <td>${esc(post.category)}</td><td><span class="status ${post.status}">${post.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
    <td>${esc(post.date)}</td><td>${seoScore(post)}/4</td>
    <td><div class="row-actions"><button data-action="edit" data-slug="${esc(post.slug)}">تحرير</button>${post.status === 'published' ? `<button data-action="view" data-slug="${esc(post.slug)}">عرض</button>` : ''}<button class="delete" data-action="delete" data-slug="${esc(post.slug)}">حذف</button></div></td>
  </tr>`).join('') : '<tr><td class="empty" colspan="6">لا توجد مقالات هنا بعد. أنشئ أول مقال من الزر بالأعلى.</td></tr>';
  document.getElementById('stat-total').textContent = posts.length;
  document.getElementById('stat-published').textContent = posts.filter(post => post.status === 'published').length;
  document.getElementById('stat-draft').textContent = posts.filter(post => post.status !== 'published').length;
  document.getElementById('stat-categories').textContent = new Set(posts.map(post => post.category).filter(Boolean)).size;
  document.getElementById('category-options').innerHTML = [...new Set(posts.map(post => post.category).filter(Boolean))].map(category => `<option value="${esc(category)}">`).join('');
  renderSeo();
}

function renderSeo() {
  const issues = [];
  for (const post of posts.filter(item => item.status === 'published')) {
    if (post.title.length > 60) issues.push(`عنوان «${post.title}» طويل وقد يُختصر في نتائج البحث.`);
    if (post.description.length < 70 || post.description.length > 160) issues.push(`وصف «${post.title}» يفضّل أن يكون بين 70 و160 حرفًا.`);
    if (!post.content?.includes('<h2')) issues.push(`أضف عناوين فرعية H2 إلى «${post.title}».`);
    if (!post.content?.includes('href="/')) issues.push(`أضف رابطًا داخليًا مناسبًا إلى «${post.title}» إن كان يخدم القارئ.`);
  }
  document.getElementById('seo-results').innerHTML = issues.length ? `<strong>${issues.length} فرصة تحسين:</strong><ul>${issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>` : '<strong>أساسيات SEO للمقالات المنشورة مكتملة.</strong> راجع المحتوى والمصادر دوريًا.';
}

function preview() {
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const slug = document.getElementById('slug').value;
  document.getElementById('preview-title').textContent = title || 'عنوان المقال يظهر هنا';
  document.getElementById('preview-description').textContent = description || 'وصف المقال يظهر هنا لمعاينة شكل النتيجة.';
  document.getElementById('preview-url').textContent = `https://hudnaapp.com/blog/${slug || 'your-article'}/`;
  const count = document.getElementById('description-count');
  count.textContent = `${description.length} / 170`;
  count.classList.toggle('warn', description.length > 160 || description.length < 70);
  document.getElementById('content-preview').innerHTML = safeContent(document.getElementById('content').value);
}

function openEditor(post) {
  form.reset();
  editingSlug = post?.slug || null;
  document.getElementById('editor-title').textContent = post ? 'تحرير المقال' : 'مقال جديد';
  document.getElementById('delete-post').hidden = !post;
  for (const id of ['title', 'slug', 'description', 'category', 'date', 'cover', 'content']) {
    document.getElementById(id).value = post?.[id] || (id === 'date' ? new Date().toLocaleDateString('en-CA') : '');
  }
  document.getElementById('tags').value = (post?.tags || []).join('، ');
  document.getElementById('publish-post').textContent = post?.status === 'published' ? 'حفظ التعديلات' : 'نشر المقال';
  preview();
  dialog.showModal();
}

async function load() {
  try {
    const [postsResponse, revisionResponse] = await Promise.all([
      fetch('/blog/posts.json', { cache: 'no-store' }),
      fetch('/__revision', { cache: 'no-store' }),
    ]);
    if (!postsResponse.ok || !revisionResponse.ok) throw new Error('local_server_required');
    posts = await postsResponse.json();
    baseRevision = (await revisionResponse.json()).revision;
    render();
  } catch {
    document.getElementById('new-post').disabled = true;
    rows.innerHTML = '<tr><td class="empty" colspan="6">شغّل npm run dev من مجلد المشروع، ثم افتح http://127.0.0.1:4173/admin/</td></tr>';
    notify('اللوحة تحتاج خادم VS Code المحلي لحفظ الملفات.');
  }
}

async function loadSite() {
  try {
    const [siteResponse, revisionResponse] = await Promise.all([
      fetch('/site-content.json', { cache: 'no-store' }),
      fetch('/__site-revision', { cache: 'no-store' }),
    ]);
    if (!siteResponse.ok || !revisionResponse.ok) throw new Error('local_server_required');
    const site = await siteResponse.json();
    siteRevision = (await revisionResponse.json()).revision;
    for (const [key, id] of Object.entries({ seoTitle: 'site-seo-title', seoDescription: 'site-seo-description', heroTitle: 'site-hero-title', heroSubtitle: 'site-hero-subtitle', primaryCtaText: 'site-primary-cta-text', primaryCtaHref: 'site-primary-cta-href', primaryCtaBadge: 'site-primary-cta-badge', howTitle: 'site-how-title', howDescription: 'site-how-description', soonTitle: 'site-soon-title', soonDescription: 'site-soon-description' })) {
      document.getElementById(id).value = site[key] || '';
    }
    document.getElementById('feature-fields').innerHTML = (site.features || []).map((feature, index) => `<div class="card"><div class="field"><label for="feature-title-${index}">ميزة ${index + 1} — العنوان</label><input id="feature-title-${index}" name="featureTitle${index}" value="${esc(feature.title)}" required /></div><div class="field"><label for="feature-description-${index}">الوصف</label><textarea id="feature-description-${index}" name="featureDescription${index}" required>${esc(feature.description)}</textarea></div></div>`).join('');
  } catch { document.querySelector('#site-form button[type=submit]').disabled = true; }
}

async function save(status) {
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  const slug = data.slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { notify('الرابط الدائم يحتاج حروفًا إنجليزية صغيرة وأرقامًا وشرطات.'); return; }
  if (posts.some(post => post.slug === slug && post.slug !== editingSlug)) { notify('الرابط مستخدم بالفعل. اختر رابطًا آخر.'); return; }
  const original = posts.find(post => post.slug === editingSlug);
  const content = safeContent(data.content);
  const post = {
    slug, title: data.title.trim(), description: data.description.trim(), category: data.category.trim(),
    tags: data.tags.split(/[,،]/).map(tag => tag.trim()).filter(Boolean), date: data.date, status,
    cover: data.cover.trim(), content,
    readingTime: Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length / 180)),
    updated: new Date().toLocaleDateString('en-CA'), created: original?.created || new Date().toLocaleDateString('en-CA'),
  };
  const next = [...posts.filter(item => item.slug !== editingSlug), post];
  try {
    const response = await fetch('/__save-post', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Content-Revision': baseRevision },
      body: JSON.stringify({ posts: next }),
    });
    if (!response.ok) throw new Error(await response.text());
    baseRevision = (await response.json()).revision;
    posts = next;
    dialog.close(); render();
    notify(status === 'published' ? 'تم حفظ المقال المنشور وتحديث ملفات SEO.' : 'تم حفظ المسودة في ملفات المشروع.');
  } catch (error) {
    notify(error.message === 'revision_conflict' ? 'تغيرت الملفات خارج اللوحة. حدّث الصفحة قبل الحفظ.' : `تعذر حفظ الملف: ${error.message}`);
  }
}

async function deletePost(post) {
  if (!post || !confirm(`حذف المقال «${post.title}»؟`)) return;
  try {
    const response = await fetch('/__delete-post', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Content-Revision': baseRevision },
      body: JSON.stringify({ slug: post.slug }),
    });
    if (!response.ok) throw new Error(await response.text());
    baseRevision = (await response.json()).revision;
    posts = posts.filter(item => item.slug !== post.slug);
    dialog.close(); render(); notify('حُذف المقال وتحدثت ملفات الموقع.');
  } catch (error) { notify(error.message === 'revision_conflict' ? 'تغيرت الملفات خارج اللوحة. حدّث الصفحة.' : `تعذر الحذف: ${error.message}`); }
}

document.getElementById('new-post').addEventListener('click', () => openEditor());
document.getElementById('close-editor').addEventListener('click', () => dialog.close());
document.getElementById('make-slug').addEventListener('click', () => {
  const title = document.getElementById('title').value;
  const suggested = title.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  document.getElementById('slug').value = suggested || `article-${new Date().toLocaleDateString('en-CA').replaceAll('-', '')}`;
  preview();
});
document.getElementById('save-draft').addEventListener('click', () => save('draft'));
form.addEventListener('submit', event => { event.preventDefault(); save('published'); });
for (const id of ['title', 'slug', 'description']) document.getElementById(id).addEventListener('input', preview);
document.getElementById('content').addEventListener('input', preview);
document.getElementById('content-toolbar').addEventListener('click', event => {
  const button = event.target.closest('button[data-wrap]');
  if (!button) return;
  const field = document.getElementById('content');
  const selected = field.value.slice(field.selectionStart, field.selectionEnd) || 'اكتب هنا';
  const tag = button.dataset.wrap;
  const replacement = tag === 'ul' ? `<ul><li>${selected}</li></ul>` : tag === 'a' ? `<a href="/blog/">${selected}</a>` : `<${tag}>${selected}</${tag}>`;
  field.setRangeText(replacement, field.selectionStart, field.selectionEnd, 'select');
  field.focus(); preview();
});
document.getElementById('filter-search').addEventListener('input', render);
document.getElementById('filter-status').addEventListener('change', render);
rows.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const post = posts.find(item => item.slug === button.dataset.slug);
  if (button.dataset.action === 'edit') openEditor(post);
  if (button.dataset.action === 'view') window.open(`/blog/${encodeURIComponent(post.slug)}/`, '_blank', 'noopener');
  if (button.dataset.action === 'delete') deletePost(post);
});
document.getElementById('delete-post').addEventListener('click', () => deletePost(posts.find(post => post.slug === editingSlug)));
document.getElementById('site-form').addEventListener('submit', async event => {
  event.preventDefault();
  const site = Object.fromEntries(new FormData(event.target));
  site.features = Array.from({ length: 5 }, (_, index) => ({ title: site[`featureTitle${index}`], description: site[`featureDescription${index}`] }));
  for (let index = 0; index < 5; index++) { delete site[`featureTitle${index}`]; delete site[`featureDescription${index}`]; }
  try {
    const response = await fetch('/__save-site', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Content-Revision': siteRevision },
      body: JSON.stringify(site),
    });
    if (!response.ok) throw new Error(await response.text());
    siteRevision = (await response.json()).revision;
    notify('تم تحديث الصفحة الرئيسية وملف بياناتها داخل المشروع.');
  } catch (error) { notify(error.message === 'revision_conflict' ? 'تغيرت الصفحة خارج اللوحة. حدّث الصفحة قبل الحفظ.' : `تعذر حفظ الصفحة: ${error.message}`); }
});
load();
loadSite();
