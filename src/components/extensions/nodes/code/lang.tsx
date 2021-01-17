import { tagExtension, EditorState } from "@codemirror/state";
import { htmlLanguage, html } from "@codemirror/lang-html";
import { language } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";

const languageTag = Symbol("language");
const tsx = () => javascript({ jsx: true, typescript: true });

export default function lang() {
  const autoLanguage = EditorState.transactionExtender.of((tr) => {
    if (!tr.docChanged) {
      return null;
    }
    let docIsHTML = /^\s*</.test(tr.newDoc.sliceString(0, 100));
    let stateIsHTML = tr.startState.facet(language) === htmlLanguage;
    if (docIsHTML === stateIsHTML) {
      return null;
    }

    return {
      reconfigure: {
        [languageTag]: docIsHTML ? html() : tsx(),
      },
    };
  });
  return [tagExtension(languageTag, tsx()), autoLanguage];
}
