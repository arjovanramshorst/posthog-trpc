import {PostHog} from "posthog-node";

const POSTHOG_KEY = ''
const POSTHOG_HOST = 'https://eu.posthog.com'

export const posthogClient = new PostHog(POSTHOG_KEY, {host: POSTHOG_HOST})
