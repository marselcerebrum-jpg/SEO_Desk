import { PROMPT_STEPS, missingPromptSteps } from './pipeline/run';
import type { Platform } from './pipeline/types';

// Apa saja yang masih kurang agar platform bisa generate.
export function platformReadiness(p: Platform) {
  const missingPrompts = missingPromptSteps(p);
  const prompts = PROMPT_STEPS.length - missingPrompts.length;
  const domain = !!p.domain;
  const wp = !!(p.wp_username.trim() && p.wp_app_password.trim());
  const missing = [
    !domain && 'domain',
    missingPrompts.length > 0 && `prompt ${prompts}/${PROMPT_STEPS.length}`,
    !wp && 'username/password WP',
  ].filter((x): x is string => !!x);
  return { domain, prompts, promptTotal: PROMPT_STEPS.length, wp, missing, ready: missing.length === 0 };
}
