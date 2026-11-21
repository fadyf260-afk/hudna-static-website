import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function addHomeContact(root) {
  for (const en of [false, true]) {
    const path = join(root, en ? 'en/index.html' : 'index.html');
    let html = await readFile(path, 'utf8');
    const chat = 'https://wa.me/201551089713';
    const label = en ? 'Chat on WhatsApp' : 'كلّمنا على واتساب';
    const section = `<section class="home-contact" aria-labelledby="payment-title"><div class="wrap"><div class="card"><h2 id="payment-title">${en ? 'Pay with an electronic wallet' : 'تقدر تدفع بالمحفظة الإلكترونية'}</h2><p>${en ? 'Electronic wallet payment is available. Contact us on WhatsApp for payment details and help.' : 'الدفع بالمحفظة الإلكترونية متاح. كلّمنا على واتساب لمعرفة تفاصيل الدفع أو لو محتاج مساعدة.'}</p><a class="btn btn-primary" href="${chat}" target="_blank" rel="noopener noreferrer">${label}</a><nav class="home-social" aria-label="${en ? 'Follow Hudna' : 'تابع هُدنة'}"><a href="https://www.facebook.com/profile.php?id=61583874756705" target="_blank" rel="noopener noreferrer">Facebook</a><a href="https://www.tiktok.com/@hudnaapp" target="_blank" rel="noopener noreferrer">TikTok</a><a href="https://www.instagram.com/hudna_app/" target="_blank" rel="noopener noreferrer">Instagram</a></nav></div></div></section>`;
    const widget = `<a class="home-whatsapp" href="${chat}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-1 3 3 7 6 8l2-2-3-2-1 1-2-2 1-1-2-2Z"/></svg><span>WhatsApp</span></a>`;
    html = html.replace('</main>', `${section}</main>`).replace('</body>', `${widget}</body>`);
    await writeFile(path, html, 'utf8');
  }
}
