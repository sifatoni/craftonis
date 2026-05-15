import { normalizePhone } from './email-extractor';

export function mergeLeads(leads1: any[], leads2: any[]): any[] {
  const all = [...leads1, ...leads2];
  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  const byLinkedin = new Map<string, number>();
  const result: any[] = [];
  for (const lead of all) {
    const email = (lead.email || '').toLowerCase().trim();
    const phone = normalizePhone(lead.phone || '') || (lead.phone || '').trim();
    const linkedin = (lead.linkedinUrl || '').toLowerCase().split('?')[0];
    let existingIdx = -1;
    if (email && byEmail.has(email)) existingIdx = byEmail.get(email)!;
    else if (phone && byPhone.has(phone)) existingIdx = byPhone.get(phone)!;
    else if (linkedin && byLinkedin.has(linkedin)) existingIdx = byLinkedin.get(linkedin)!;
    if (existingIdx !== -1) {
      const existing = result[existingIdx];
      const winner = (lead.contactScore||0) >= (existing.contactScore||0) ? lead : existing;
      const loser = winner === lead ? existing : lead;
      result[existingIdx] = { ...winner, email: winner.email||loser.email, phone: winner.phone||loser.phone, organization: winner.organization||loser.organization, linkedinUrl: winner.linkedinUrl||loser.linkedinUrl };
      const me = (result[existingIdx].email||'').toLowerCase().trim();
      const mp = normalizePhone(result[existingIdx].phone||'')||(result[existingIdx].phone||'').trim();
      const ml = (result[existingIdx].linkedinUrl||'').toLowerCase().split('?')[0];
      if (me) byEmail.set(me, existingIdx);
      if (mp) byPhone.set(mp, existingIdx);
      if (ml) byLinkedin.set(ml, existingIdx);
    } else {
      const idx = result.length;
      result.push(lead);
      if (email) byEmail.set(email, idx);
      if (phone) byPhone.set(phone, idx);
      if (linkedin) byLinkedin.set(linkedin, idx);
    }
  }
  return result;
}
