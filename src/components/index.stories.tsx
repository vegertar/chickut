import React from "react";
import { Story, StoryContext, Meta } from "@storybook/react/types-6-0";

import Theme, { themes } from "./theme";
import Editor from "./editor";

export const extensionDecorators = [
  (Story: Story, { args }: StoryContext) => (
    <Theme
      theme={args.theme}
      style={{
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      <Editor autoFix>
        <Story />
      </Editor>
    </Theme>
  ),
];

export const extensionArgs = {
  theme: "light",
};

export const extensionMeta = (extension: any) => {
  const kind = extension.node ? "Nodes" : extension.mark ? "Marks" : "Plugins";

  return {
    title: `extensions/${kind}/${extension.name}`,
    component: extension,
    decorators: extensionDecorators,
    args: extensionArgs,
    argTypes: {
      theme: {
        control: {
          type: "inline-radio",
          options: Object.keys(themes),
        },
      },
    },
  } as Meta;
};
