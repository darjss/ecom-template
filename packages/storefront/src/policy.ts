import { micromark } from "micromark";

export const renderPolicyMarkdown = (markdown: string) =>
  micromark(markdown, { allowDangerousHtml: false, allowDangerousProtocol: false });
