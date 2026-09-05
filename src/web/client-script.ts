import { WEB_CLIENT_BUNDLE } from "./client-bundle.generated";

/** Prebuilt browser entry; source and standalone serve the same bytes. */
export function webClientScript(): string { return WEB_CLIENT_BUNDLE; }
