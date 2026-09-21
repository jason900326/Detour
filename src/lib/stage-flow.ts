import type { Stage } from './app-model';

export const STAGE_TRANSITIONS: Readonly<Record<Stage, readonly Stage[]>> = {
  boot: ['onboarding', 'time'],
  onboarding: ['settings', 'time'],
  settings: ['time', 'onboarding'],
  time: ['mood', 'settings', 'passport', 'preparing'],
  mood: ['time', 'preparing'],
  preparing: ['mood', 'ready'],
  ready: ['mood', 'journey'],
  journey: ['arrival', 'sceneIssue', 'finish'],
  arrival: ['journey', 'sceneIssue', 'developing', 'finish'],
  sceneIssue: ['arrival', 'journey'],
  developing: ['finish'],
  finish: ['time', 'settings', 'passport'],
  passport: ['time', 'passportDetail'],
  passportDetail: ['passport'],
};

export const ABANDONABLE_STAGES: ReadonlySet<Stage> = new Set([
  'ready',
  'journey',
  'arrival',
  'sceneIssue',
]);

export function canTransition(from: Stage, to: Stage) {
  return STAGE_TRANSITIONS[from].includes(to);
}
