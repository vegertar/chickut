import React from "react";
import { Story, StoryContext, Meta } from "@storybook/react/types-6-0";

import Theme, { themes } from "./theme";
import Editor from "./editor";
import { Base, Paragraph } from "./extensions";

type MetaProps = {
  theme?: string;
  text?: string;
};

export function template<P = {}>(Component: React.FC<P>): Story<P & MetaProps> {
  return (args) => <Component {...args} />;
}

export const minimal = [Base, Paragraph];

export function withThemedEditor<P>(Extension: React.FC<P>, addon = minimal) {
  return (props: P) => (
    <Theme>
      <Editor>
        <Extension {...props} />
        {addon.map((Extension) => (
          <Extension key={Extension.name} />
        ))}
      </Editor>
    </Theme>
  );
}

export function meta<P = {}>(
  kind: "Nodes" | "Marks" | "Plugins",
  extension: React.FC<P>,
  addon = minimal
): Meta<MetaProps> {
  const name = extension.name;

  return {
    title: `extensions/${kind}/${name}`,
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
            <Editor text={args.text}>
              <NamedStory />
              {addon.map((Extension) => (
                <Extension key={Extension.name} />
              ))}
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
  };
}
