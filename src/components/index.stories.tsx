import React from "react";
import { Story, StoryContext, Meta } from "@storybook/react/types-6-0";

import Theme, { themes } from "./theme";
import Editor from "./editor";
import { Doc, Paragraph, Text, Keymap } from "./extensions";

export const minimalExtensions = (
  <>
    <Doc />
    <Paragraph />
    <Text />
    <Keymap />
  </>
);

export const withThemedEditor = (
  Extension: React.FC<any>,
  addon = minimalExtensions
) => () => (
  <Theme>
    <Editor>
      <Extension />
      {addon}
    </Editor>
  </Theme>
);

export const extensionMeta = (extension: any, addon = minimalExtensions) => {
  const kind = extension.node ? "Nodes" : extension.mark ? "Marks" : "Plugins";
  const name = extension.name;

  return {
    title: `extensions/${kind}/${extension.name}`,
    component: extension,
    decorators: [
      (Story: Story, { args }: StoryContext) => {
        const NamedStory = {
          [name]: () => <Story />,
        }[name];

        return (
          <Theme
            theme={args.theme}
            style={{
              margin: "0 auto",
              padding: "0 20px",
            }}
          >
            <Editor>
              <NamedStory />
              {addon}
            </Editor>
          </Theme>
        );
      },
    ],
    args: {
      theme: "light",
    },
    argTypes: {
      theme: {
        control: {
          type: "inline-radio",
          options: Object.keys(themes),
        },
      },
    },
    parameters: {
      backgrounds: { default: "light" },
    },
  } as Meta;
};
