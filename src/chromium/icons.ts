import { SuggestTemplateInfo, SuggestTemplateInfo_IconType as IconType } from '../proto/chromium_suggest_pb';

// Chromium AutocompleteMatch::GetVectorIcon, rounded icons branch.
export function chromiumIcon(type = 'QUERY', template?: SuggestTemplateInfo): string {
  let name: string;
  switch (template?.typeIcon) {
    case IconType.HISTORY: name = 'history'; break;
    case IconType.NOTES_SPARK: name = 'notes_spark'; break;
    case IconType.SEARCH_LOOP: name = 'search'; break;
    case IconType.SEARCH_LOOP_WITH_SPARKLE: name = 'search_spark'; break;
    case IconType.TRENDING: name = 'trending_up'; break;
    case IconType.SUB_ARROW_RIGHT: name = 'subdirectory_arrow_right'; break;
    case IconType.PROMPT_SUGGESTION: name = 'prompt_suggestion'; break;
    case undefined:
    case IconType.ICON_TYPE_UNSPECIFIED:
      name = type === 'CALCULATOR' ? 'equal' : /PERSONALIZED|HISTORY/.test(type) ? 'history' : /NAVIGATION/.test(type) ? 'public' : 'search';
      break;
    default: name = 'search';
  }
  return `/icon/chromium/${name}.svg`;
}

export function decodeSuggestTemplate(encoded?: string): SuggestTemplateInfo | undefined {
  if (!encoded) return undefined;
  try { return SuggestTemplateInfo.fromBinary(new Uint8Array(Buffer.from(encoded, 'base64'))); } catch { return undefined; }
}
