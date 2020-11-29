import React from "react";
import { Story, Meta } from "@storybook/react/types-6-0";

import Extension from "./index";
import ListItem from "../listitem";
import { withThemedEditor } from "../../../index.stories";

const extension = Extension as any;
const kind = extension.node ? "Nodes" : extension.mark ? "Marks" : "Plugins";

const Component = withThemedEditor(Extension, <ListItem />);
type Props = Parameters<typeof Component>[0];

export default {
  title: `${kind}/${Extension.name}`,
  component: Component,
  argTypes: {
    // TODO
    backgroundColor: { control: "color" },
  },
} as Meta;

const Template: Story<Props> = (args) => <Component {...args} />;

export const Light = Template.bind({});
Light.args = { theme: "light" };

export const Dark = Template.bind({});
Dark.args = { theme: "dark" };
