import React from "react";
import { Story } from "@storybook/react/types-6-0";

import ListItem from "../listitem";
import Extension from "./index";
import { extensionMeta, minimalExtensions } from "../../../index.stories";

export default extensionMeta(Extension, [...minimalExtensions, ListItem]);

type Args = Parameters<typeof Extension>[0];
const Template: Story<Args> = (args) => <Extension {...args} />;

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
