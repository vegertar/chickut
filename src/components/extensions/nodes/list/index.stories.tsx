import React from "react";
import { Story } from "@storybook/react/types-6-0";

import Extension from "./index";
import { extensionMeta } from "../../../index.stories";

export default extensionMeta("Nodes", Extension);

// type Args = Parameters<typeof Extension>[0];
const Template: Story = (args) => <Extension {...args} />;

export const Single = Template.bind({});
Single.args = {
  text: "- the first line",
};

export const Multiple = Template.bind({});
Multiple.args = {
  text: `${Single.args.text}
- the second line
- the third line`,
};

export const Nested = Template.bind({});
Nested.args = {
  text: `+ Create a list by starting a line with +, -, or *
+ Sub-lists are made by indenting 2 spaces:
  - Marker character change forces new list start:
    * Ac tristique libero volutpat at
    + Facilisis in pretium nisl aliquet
    - Nulla volutpat aliquam velit
+ Very easy!`,
};
