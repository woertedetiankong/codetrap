import { browserLocale, readBrowserBoot, showBootstrapFailure, translate } from "./platform";
import { mountWorkspace } from "./workspace";

try {
  mountWorkspace(readBrowserBoot(window));
} catch (error) {
  const locale = browserLocale(window);
  showBootstrapFailure(document, locale, key => translate(locale, key), error);
  document.getElementById("bootstrap-retry")?.addEventListener("click", () => location.reload());
}
