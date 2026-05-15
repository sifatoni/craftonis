const PERSONAL_EMAIL_RE = /gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|live\.com|protonmail\.com|ymail\.com|icloud\.com|aol\.com/i;
const DESIGNATION_KEYWORDS = ['ceo','cto','cfo','coo','cmo','founder','co-founder','director','head','vp','vice president','president','manager','lead','chief','partner','owner','md','managing director','general manager','marketing head'];

export function scoreLead(lead: any, targetDesignations: string[] = []): any {
  const email = (lead.email || '').toLowerCase().trim();
  const phone = (lead.phone || '').trim();
  const linkedin = (lead.linkedinUrl || '').trim();
  const designation = (lead.designation || '').toLowerCase().trim();
  const organization = (lead.organization || '').trim();
  const breakdown = { email: 0, phone: 0, linkedin: 0, designation: 0, company: 0 };
  if (email) breakdown.email = 40;
  if (phone) breakdown.phone = 30;
  if (linkedin && linkedin.includes('linkedin.com')) breakdown.linkedin = 15;
  if (designation) {
    const matchesTarget = targetDesignations.some(d => designation.includes(d.toLowerCase()) || d.toLowerCase().includes(designation));
    const matchesKnown = DESIGNATION_KEYWORDS.some(kw => designation.includes(kw));
    if (matchesTarget || matchesKnown) breakdown.designation = 10;
  }
  if (organization && organization.length > 1) breakdown.company = 5;
  const total = breakdown.email + breakdown.phone + breakdown.linkedin + breakdown.designation + breakdown.company;
  const valueBand = total >= 80 ? 'High' : total >= 50 ? 'Medium' : 'Low';
  const emailType = email ? (PERSONAL_EMAIL_RE.test(email) ? 'Personal' : 'Business') : '';
  return { ...lead, email, phone, contactScore: total, valueBand, emailType };
}

export function deduplicateLeads(leads: any[]): any[] {
  const seen = new Set<string>();
  return leads.filter(lead => {
    const keys = [
      lead.email ? `email:${lead.email}` : null,
      lead.phone ? `phone:${lead.phone}` : null,
      lead.linkedinUrl ? `li:${lead.linkedinUrl.toLowerCase().split('?')[0]}` : null,
    ].filter(Boolean) as string[];
    const isDup = keys.some(k => seen.has(k));
    if (!isDup) keys.forEach(k => seen.add(k));
    return !isDup;
  });
}

export function scoreAndClean(leads: any[], keywords: string[] = []): any[] {
  const scored = leads.map(l => scoreLead(l, keywords));
  const withContact = scored.filter(l => l.email || l.phone || (l.linkedinUrl && l.linkedinUrl.includes('linkedin.com')));
  const deduped = deduplicateLeads(withContact);
  return deduped.sort((a, b) => b.contactScore - a.contactScore);
}
