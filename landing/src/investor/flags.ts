/**
 * Additive Startup Validation flags (startup_validation_additive_startup_investor.md §2.3).
 * Master flag keeps Matching / portal unchanged when off.
 */

export type ValidationFeatureFlags = {
  startupValidationEnabled: boolean
  investorSetupEnabled: boolean
  pitchRoundEnabled: boolean
  aiQnaEnabled: boolean
  businessSimulationEnabled: boolean
  productVideoProofEnabled: boolean
  finalReviewEnabled: boolean
  validationNotificationEnabled: boolean
}

function envBool(name: string, fallback: boolean): boolean {
  const v =
    process.env[`NEXT_PUBLIC_${name}`] ??
    process.env[name] ??
    (fallback ? 'true' : 'false')
  return String(v).toLowerCase() === 'true' || v === '1'
}

/** Master switch — same as legacy isInvestorPipelineEnabled */
export function isInvestorPipelineEnabled(): boolean {
  return envBool('ENABLE_INVESTOR_PIPELINE', true)
}

/**
 * Granular flags. Each sub-flag defaults ON only if master is ON.
 * Override with NEXT_PUBLIC_VALIDATION_*_ENABLED=false
 */
export function getValidationFlags(): ValidationFeatureFlags {
  const master = isInvestorPipelineEnabled()
  if (!master) {
    return {
      startupValidationEnabled: false,
      investorSetupEnabled: false,
      pitchRoundEnabled: false,
      aiQnaEnabled: false,
      businessSimulationEnabled: false,
      productVideoProofEnabled: false,
      finalReviewEnabled: false,
      validationNotificationEnabled: false,
    }
  }
  return {
    startupValidationEnabled: envBool('VALIDATION_STARTUP_ENABLED', true),
    investorSetupEnabled: envBool('VALIDATION_INVESTOR_SETUP_ENABLED', true),
    pitchRoundEnabled: envBool('VALIDATION_PITCH_ENABLED', true),
    aiQnaEnabled: envBool('VALIDATION_AI_QNA_ENABLED', true),
    businessSimulationEnabled: envBool('VALIDATION_SIM_ENABLED', true),
    productVideoProofEnabled: envBool('VALIDATION_PROOF_ENABLED', true),
    finalReviewEnabled: envBool('VALIDATION_FINAL_ENABLED', true),
    validationNotificationEnabled: envBool(
      'VALIDATION_NOTIFICATION_ENABLED',
      true,
    ),
  }
}

export function isValidationEnabled(): boolean {
  return getValidationFlags().startupValidationEnabled
}

/** API-style disabled payload when flag off */
export function featureDisabledError() {
  return {
    success: false,
    message: 'Feature disabled',
    error: { code: 'FEATURE_DISABLED' },
  }
}
