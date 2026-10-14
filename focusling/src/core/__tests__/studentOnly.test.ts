import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Studyling is student-only. The former Family Mode (parent PIN, Child View,
 * parent area, family onboarding) must not come back as routes, state or code.
 */
const ROOT = join(__dirname, '..', '..');
const APP = join(ROOT, 'app');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('student-only product', () => {
  it('has no parent, child or family routes', () => {
    for (const route of ['(child)', 'parent', 'parent-gate.tsx', 'onboarding/who.tsx', 'onboarding/family-intro.tsx', 'onboarding/family-pin.tsx', 'onboarding/family-child.tsx', 'onboarding/family-mission.tsx']) {
      expect(existsSync(join(APP, route))).toBe(false);
    }
    const routeFiles = files(APP).map((f) => f.slice(APP.length));
    expect(routeFiles.filter((f) => /parent|child|family/i.test(f))).toEqual([]);
  });

  it('has no family modules, state or Child View checks in the source', () => {
    for (const dir of ['core/family', 'features/family', 'config/family.ts', 'core/models/family.ts']) expect(existsSync(join(ROOT, dir))).toBe(false);
    const banned = /familyView|useIsChildView|childView|ParentGate|parentGate|setParentPin|enterChildView|chooseMode|mode === 'family'|\/\(child\)|\/parent-gate|FamilySettings|AppMode\b/;
    const offenders = files(ROOT)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('studentOnly.test.ts') && !f.includes('save/migrations.ts') && !f.endsWith('migrations.test.ts'))
      .filter((f) => banned.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(ROOT.length))).toEqual([]);
  });
});
