import React from "react";
import { Story, StoryContext, Meta } from "@storybook/react/types-6-0";

import Theme, { themes } from "./theme";
import Editor from "./editor";

export const withThemedEditor = (
  Extension: React.FC<any>,
  addon: React.ReactNode
) => () => (
  <Theme>
    <Editor autoFix>
      <Extension />
      {addon}
    </Editor>
  </Theme>
);

export const extensionMeta = (extension: any) => {
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
            <Editor autoFix>
              <NamedStory />
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
