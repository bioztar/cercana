// Pure logic for the fallback (photo-less) avatar. No React / RN imports so `node --test` can run it.

/** One letter, unless someone else in `group` shares it — then two, picking the earliest letter
 * of each name that isn't already spoken for: Masha keeps "Ma" (its natural 2nd letter), Maxim's
 * "Ma" is taken so it moves on to "Mx". `group` should include `name` itself; order matters (the
 * first name in the list keeps the natural 2-letter tag). */
export function avatarInitials(name: string, group: string[] = []): string {
  const n = name.trim();
  const first = n.charAt(0).toUpperCase();
  if (!first) return '?';

  const colliding: string[] = [];
  const seen = new Set<string>();
  for (const g of group) {
    const gt = g.trim();
    if (!gt || gt.charAt(0).toUpperCase() !== first || seen.has(gt)) continue;
    seen.add(gt);
    colliding.push(gt);
  }
  if (!seen.has(n)) colliding.push(n);
  if (colliding.length <= 1) return first;

  const usedSecond = new Set<string>();
  let myTag = first;
  for (const cn of colliding) {
    let tag: string | null = null;
    for (let i = 1; i < cn.length; i++) {
      const ch = cn.charAt(i).toLowerCase();
      if (!usedSecond.has(ch)) {
        tag = first + ch;
        usedSecond.add(ch);
        break;
      }
    }
    tag ??= first + (cn.charAt(1)?.toLowerCase() ?? ''); // every letter taken: fall back, may still collide
    if (cn === n) myTag = tag;
  }
  return myTag;
}
