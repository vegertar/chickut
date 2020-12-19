import React from "react";
import { Story } from "@storybook/react/types-6-0";

import Extension from "./index";
import { extensionMeta } from "../../../index.stories";

export default extensionMeta("Nodes", Extension);

type Args = Parameters<typeof Extension>[0];
const Template: Story<Args> = (args) => <Extension {...args} />;

export const First = Template.bind({});
First.args = {
  text: "# hello",
};

export const Second = Template.bind({});
Second.args = {
  text: "## hello",
};

export const Third = Template.bind({});
Third.args = {
  text: "### hello",
};

export const Fourth = Template.bind({});
Fourth.args = {
  text: "#### hello",
};

export const Fifth = Template.bind({});
Fifth.args = {
  text: "##### hello",
};

export const Sixth = Template.bind({});
Sixth.args = {
  text: "###### hello",
};
