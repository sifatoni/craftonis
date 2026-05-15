const EMAIL_DOMAINS = ['@gmail.com','@yahoo.com','@outlook.com','@hotmail.com','@icloud.com','@aol.com'];
const DESIGNATION_MAP: Record<string, string[]> = {
  ceo: ['CEO','Chief Executive Officer','Managing Director','MD'],
  cto: ['CTO','Chief Technology Officer','VP Engineering','Head of Technology'],
  cfo: ['CFO','Chief Financial Officer','Finance Director','Head of Finance'],
  cmo: ['CMO','Chief Marketing Officer','Marketing Director','Head of Marketing'],
  director: ['Director','Head','VP','Vice President'],
  manager: ['Manager','Lead','Senior Manager','Head'],
  founder: ['Founder','Co-Founder','Owner','Proprietor'],
  'marketing head': ['Marketing Head','Head of Marketing','Marketing Director','CMO'],
  president: ['President','Managing Director','CEO','Executive Director'],
  coo: ['COO','Chief Operating Officer','Operations Director','Head of Operations'],
  'hr head': ['HR Head','Head of HR','HR Director','Chief People Officer'],
};
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function getVariants(designation: string): string[] {
  if (!designation) return ['CEO'];
  return DESIGNATION_MAP[designation.toLowerCase().trim()] || [designation];
}

export function buildLinkedInQueries(designation: string, area: string, industry: string, country: string, organization?: string): string[] {
  const variants = getVariants(designation);
  const [v0, v1, v2, v3] = [variants[0], variants[1]||variants[0], variants[2]||variants[0], variants[3]||variants[0]];
  const org = organization ? `"${organization}"` : '';
  const seen = new Set<string>();
  const candidates: string[] = [];
  function add(q: string) {
    const norm = q.trim().toLowerCase();
    if (!seen.has(norm) && q.trim()) { seen.add(norm); candidates.push(q.trim()); }
  }
  // Always aggressive — always include email domains
  const emailFilter = `("${pick(EMAIL_DOMAINS)}" OR "${pick(EMAIL_DOMAINS)}")`;
  if (area) add(`site:linkedin.com/in "${v0}" "${industry}" "${area}" ${org} "@gmail.com"`);
  add(`site:linkedin.com/in "${industry}" "${country}" "${v1}" ${org} "@yahoo.com"`);
  if (area) add(`site:linkedin.com/in "${v0}" "${industry}" "${area}" ${org} "@gmail.com" OR "@yahoo.com" OR "@outlook.com"`);
  add(`site:linkedin.com/in ${industry} ${country} "${v2}" ${org} "@hotmail.com"`);
  if (variants.length > 1) {
    const orGroup = variants.slice(0,3).map(v=>`"${v}"`).join(' OR ');
    const loc = area ? `"${area}"` : `"${country}"`;
    add(`site:linkedin.com/in (${orGroup}) "${industry}" ${loc} ${org} "@gmail.com"`);
  }
  if (area) add(`site:linkedin.com/in "${v1}" "${area}" "${country}" ${org} "@outlook.com"`);
  add(`"${v0}" "${industry}" ${area?`"${area}"`:`"${country}"`} site:linkedin.com/in ${org} "@aol.com"`);
  add(`site:linkedin.com/in "${v3}" "${industry}" "${country}" ${org} "@icloud.com"`);
  if (area) add(`site:linkedin.com/in "${v0}" "${area}" "${industry}" ${org}`);
  const [first, ...rest] = candidates;
  for (let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
  const ordered = first ? [first,...rest] : rest;
  return ordered.slice(0, Math.floor(Math.random()*4)+5);
}

export function buildPlatformQueries(siteFilter: string, designation: string, area: string, industry: string, country: string, organization?: string): string[] {
  const queries: string[] = [];
  const emailOrClause = '("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com" OR "@aol.com")';
  const org = organization ? `"${organization}"` : '';
  // Always aggressive
  if (area) queries.push(`site:${siteFilter} "${designation}" "${industry}" "${area}" ${org} ${emailOrClause}`);
  queries.push(`site:${siteFilter} "${designation}" "${industry}" "${country}" ${org} ${emailOrClause}`);
  queries.push(`site:${siteFilter} "${designation}" "${country}" ${org} "@gmail.com" OR "@yahoo.com"`);
  const seen = new Set<string>();
  return queries.filter(q => { const n=q.trim().toLowerCase(); if(seen.has(n))return false; seen.add(n); return true; });
}
