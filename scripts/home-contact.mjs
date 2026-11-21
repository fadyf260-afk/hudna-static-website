import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function addHomeContact(root, site) {
  for (const en of [false, true]) {
    const path = join(root, en ? 'en/index.html' : 'index.html');
    let html = await readFile(path, 'utf8');
    const number = String(site.whatsappNumber || '').replace(/[+ ()-]/g, '');
    const phone = /^01[0-9]{9}$/.test(number) ? '2'+number : number;
    if (phone && !/^[1-9][0-9]{7,14}$/.test(phone)) throw new Error('invalid_whatsapp_number');
    const chat = 'https://wa.me/'+phone;
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    for (const key of ['facebookUrl','tiktokUrl','instagramUrl']) { if (site[key] && new URL(site[key]).protocol !== 'https:') throw new Error('invalid_social_url'); }
    const label = en ? 'Chat on WhatsApp' : 'كلّمنا على واتساب';
    const section = `<section class="home-contact" aria-labelledby="payment-title"><div class="wrap"><div class="card"><h2 id="payment-title">${esc(en ? site.paymentTitleEn : site.paymentTitle)}</h2><p>${esc(en ? site.paymentDescriptionEn : site.paymentDescription)}</p><a class="btn btn-primary" href="${chat}" target="_blank" rel="noopener noreferrer">${label}</a><nav class="home-social" aria-label="${en ? 'Follow Hudna' : 'تابع هُدنة'}"><a href="${esc(site.facebookUrl)}" target="_blank" rel="noopener noreferrer">Facebook</a><a href="${esc(site.tiktokUrl)}" target="_blank" rel="noopener noreferrer">TikTok</a><a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener noreferrer">Instagram</a></nav></div></div></section>`;
    const widget = `<a class="home-whatsapp" href="${chat}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-1 3 3 7 6 8l2-2-3-2-1 1-2-2 1-1-2-2Z"/></svg><span>WhatsApp</span></a>`;
    const visibleSection = section.replace(/<a[^>]+href=""[^>]*>[^<]*<\/a>/g, '').replace(!phone ? /<a class="btn btn-primary"[^>]*>[^<]*<\/a>/g : /$^/, '');
    html = html.replace('</main>', `${visibleSection}</main>`).replace('</body>', `${phone ? widget : ''}</body>`);
    await writeFile(path, html, 'utf8');
  }
}
