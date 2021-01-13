import React from "react";
import { Story, StoryContext, Meta } from "@storybook/react/types-6-0";
import difference from "lodash.difference";

import Theme, { themes } from "../theme";
import Editor from "../editor";
import {
  Base,
  Blockquote,
  Code,
  Heading,
  HorizontalRule,
  Html,
  Image,
  List,
  Newline,
  Reference,
  Backticks,
  Emoji,
  Emphasis,
  Insert,
  Link,
  Mark,
  Strikethrough,
  Subscript,
  Superscript,
  Autolink,
  Entity,
  Escape,
  Fence,
  Lheading,
} from ".";

const all = {
  Base,
  Blockquote,
  Code,
  Heading,
  HorizontalRule,
  Html,
  Image,
  List,
  Newline,
  Reference,
  Backticks,
  Emoji,
  Emphasis,
  Insert,
  Link,
  Mark,
  Strikethrough,
  Subscript,
  Superscript,
  Autolink,
  Entity,
  Escape,
  Fence,
  Lheading,
};

type All = typeof all;
type Key = keyof All;

type MetaProps = {
  theme?: string;
  text?: string;
  addon?: Key[];
};

function Addon({ addon }: { addon: Key[] }) {
  return (
    <>
      {addon.map((key) => {
        const Extension = all[key];
        return <Extension key={key} />;
      })}
    </>
  );
}

export function template<P = {}>(Component: React.FC<P>): Story<P & MetaProps> {
  return (args) => <Component {...args} />;
}

export const minimal: Key[] = ["Base"];

export function withThemedEditor<P>(
  Extension: React.FC<P>,
  dependencies = minimal
) {
  return (props: P) => (
    <Theme>
      <Editor>
        <Extension {...props} />
        <Addon addon={dependencies} />
      </Editor>
    </Theme>
  );
}

export function meta(
  kind: "Nodes" | "Marks" | "Plugins",
  name: Key,
  dependencies = minimal
): Meta<MetaProps> {
  const addon = difference(Object.keys(all), [...dependencies, name]) as Key[];
  const extension = all[name];

  return {
    title: `Components/Extensions/${kind}/${name}`,
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
              <Addon addon={[...dependencies, ...args.addon]} />
            </Editor>
          </Theme>
        );
      },
    ],
    args: {
      theme: "light",
      addon: [],
    },
    argTypes: {
      theme: {
        control: {
          type: "inline-radio",
          options: Object.keys(themes),
        },
      },
      addon: {
        description: "available extensions to enable",
        control: {
          type: "inline-check",
          options: addon,
        },
      },
    },
    parameters: {
      backgrounds: { default: "light" },
    },
  };
}
