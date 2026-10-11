export type RegistrationOutcome = {
  authenticated: boolean;
  emailConfirmationRequired: boolean;
  attributionFromCookie: boolean | null;
};

export function publicRegistrationOutcome(outcome: RegistrationOutcome) {
  return {
    authenticated: outcome.authenticated,
    emailConfirmationRequired: outcome.emailConfirmationRequired,
    attributionFromCookie: outcome.attributionFromCookie,
  };
}

export function registrationLogSummary(input: RegistrationOutcome & {
  hasUser: boolean;
  hasSession: boolean;
  attributionAttempted: boolean;
}) {
  return {
    hasUser: input.hasUser,
    hasSession: input.hasSession,
    authenticated: input.authenticated,
    emailConfirmationRequired: input.emailConfirmationRequired,
    attributionAttempted: input.attributionAttempted,
    attributionSucceeded: input.attributionFromCookie,
  };
}
